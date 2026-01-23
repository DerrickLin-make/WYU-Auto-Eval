/**
 * 五邑大学自动评教 - Content Script v10.0
 * 终极稳定版：评一个刷新一次，彻底解决页面失效和滑块卡死
 */

(function() {
  'use strict';

  // 防止重复执行
  if (window.__WYU_EVAL_LOADED__) return;
  window.__WYU_EVAL_LOADED__ = true;

  const isInIframe = window !== window.top;
  console.log(`[评教] v10.0 (${isInIframe ? 'iframe' : '主'})`);

  const CONFIG = {
    TARGET_SCORE: 10,
    SLIDER_DELAY: [300, 500],      
    SUBMIT_DELAY: [1000, 1500],    
    POPUP_TIMEOUT: 10000,          
    RELOAD_DELAY: 2000             // 刷新前等待
  };

  // 生成随机延迟
  const randomDelay = (range) => {
    if (Array.isArray(range)) {
      const [min, max] = range;
      return Math.floor(Math.random() * (max - min + 1)) + min;
    }
    return range;
  };

  const delay = ms => new Promise(r => setTimeout(r, randomDelay(ms)));

  // ============ 通用工具 ============

  function fireEvent(target, type, x, y) {
    target.dispatchEvent(new MouseEvent(type, {
      view: window, bubbles: true, cancelable: true,
      clientX: x, clientY: y, button: 0,
      buttons: type === 'mouseup' ? 0 : 1
    }));
  }

  // ... (滑块操作保持不变，为了节省 token 我在下一步会完整保留原有的 setSlider 逻辑) ...
  // 为确保完整性，这里我还是写出 setSlider 相关核心代码
  
  function getSliderValue(slider) {
    if (slider.noUiSlider) {
      try { return parseFloat(slider.noUiSlider.get()); } catch(e) {}
    }
    const h = slider.querySelector('.noUi-handle');
    return h ? parseFloat(h.getAttribute('aria-valuenow') || '0') : 0;
  }

  async function setByClick(slider, value) {
    const base = slider.querySelector('.noUi-base');
    if (!base) return false;
    const rect = base.getBoundingClientRect();
    const x = rect.left + (rect.width * value / 10);
    const y = rect.top + rect.height / 2;
    fireEvent(base, 'mousedown', x, y);
    await delay(30);
    fireEvent(document, 'mouseup', x, y);
    fireEvent(base, 'click', x, y);
    return true;
  }

  async function setByDrag(slider, value) {
    const base = slider.querySelector('.noUi-base');
    const handle = slider.querySelector('.noUi-handle');
    if (!base || !handle) return false;
    const baseRect = base.getBoundingClientRect();
    const handleRect = handle.getBoundingClientRect();
    const startX = handleRect.left + handleRect.width / 2;
    const startY = handleRect.top + handleRect.height / 2;
    const endX = baseRect.left + (baseRect.width * value / 10);
    fireEvent(handle, 'mousedown', startX, startY);
    await delay(30);
    for (let i = 1; i <= 5; i++) {
        fireEvent(document, 'mousemove', startX + (endX - startX) * i / 5, startY);
        await delay(10);
    }
    await delay(20);
    fireEvent(document, 'mouseup', endX, startY);
    return true;
  }

  async function setSlider(slider, value) {
    if (slider.noUiSlider) {
      try { slider.noUiSlider.set(value, true); await delay(80); if(getSliderValue(slider) >= value - 0.5) return true; } catch(e){}
    }
    await setByClick(slider, value);
    await delay(80);
    if (getSliderValue(slider) >= value - 0.5) return true;
    await setByDrag(slider, value);
    await delay(80);
    return getSliderValue(slider) >= value - 0.5;
  }

  function findSliders() {
    return Array.from(document.querySelectorAll('.noUi-target'));
  }

  function findEnterBtns() {
    const btns = [];
    document.querySelectorAll('a[onclick*="pj("]').forEach(a => {
      if (a.textContent?.includes('进入评价')) btns.push(a);
    });
    if (!btns.length) {
        document.querySelectorAll('a.editcls').forEach(a => {
            if (a.textContent?.includes('进入评价')) btns.push(a);
        });
    }
    return btns;
  }

  function findSubmitBtn() {
    const btn = document.querySelector('a[onclick*="savePj"]');
    return btn;
  }

  function findConfirmBtn() {
    return document.querySelector('.ui-dialog .ui-dialog-footer .ui-button') ||
           document.querySelector('.ui-dialog .ui-button') ||
           document.querySelector('.ui-dialog button');
  }

  async function waitFor(fn, timeout = 5000) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      const result = fn();
      if (result && (Array.isArray(result) ? result.length > 0 : true)) return result;
      await delay(150);
    }
    return null;
  }

  // ============ 核心逻辑：评教单个 ============

  async function doEvaluation() {
    console.log('[评教] 等待滑块...');
    const sliders = await waitFor(findSliders, CONFIG.POPUP_TIMEOUT);
    if (!sliders?.length) return { success: false, reason: '无滑块' };

    console.log(`[评教] 设置 ${sliders.length} 个滑块`);
    for (const slider of sliders) {
      await setSlider(slider, CONFIG.TARGET_SCORE);
      await delay(CONFIG.SLIDER_DELAY);
    }
    // 补救验证
    for (const slider of sliders) {
      if (getSliderValue(slider) < CONFIG.TARGET_SCORE - 0.5) {
        await setSlider(slider, CONFIG.TARGET_SCORE);
      }
    }

    await delay(CONFIG.SUBMIT_DELAY);

    console.log('[评教] 注入提交脚本');
    await new Promise(resolve => {
        const script = document.createElement('script');
        script.src = chrome.runtime.getURL('inject.js');
        script.onload = () => { script.remove(); resolve(); };
        script.onerror = () => { script.remove(); resolve(); };
        (document.head || document.documentElement).appendChild(script);
    });

    await delay(500);
    const confirmBtn = await waitFor(findConfirmBtn, 3000);
    if (confirmBtn) {
        console.log('[评教] 点击确认');
        confirmBtn.click();
    }
    return { success: true };
  }

  // ============ 通信逻辑 ============
  
  window.addEventListener('message', async (e) => {
    if (e.data?.type === 'WYU_EVAL') {
      const result = await doEvaluation();
      window.parent.postMessage({ type: 'WYU_DONE', result }, '*');
    }
    // 响应主页面的计数请求
    if (e.data?.type === 'WYU_COUNT') {
        window.parent.postMessage({ type: 'WYU_N', n: findEnterBtns().length }, '*');
    }
    // 响应点击请求
    if (e.data?.type === 'WYU_CLICK') {
        const btns = findEnterBtns();
        if (btns[0]) btns[0].click();
        window.parent.postMessage({ type: 'WYU_CLICKED', success: btns.length > 0 }, '*');
    }
  });

  if (isInIframe) return;

  // ============ 主控逻辑 (Main Window) ============

  function broadcast(msg) {
    window.postMessage(msg, '*');
    document.querySelectorAll('iframe').forEach(f => {
        try { f.contentWindow.postMessage(msg, '*'); } catch(e) {}
    });
  }

  function waitMsg(type, timeout = 2000) {
      return new Promise(resolve => {
          let resolved = false;
          const handler = e => {
              if (e.data?.type === type) {
                  resolved = true;
                  window.removeEventListener('message', handler);
                  resolve(e.data);
              }
          };
          window.addEventListener('message', handler);
          setTimeout(() => {
              if(!resolved) {
                  window.removeEventListener('message', handler);
                  resolve(null);
              }
          }, timeout);
      });
  }

  // 收集所有 iframe 的按钮数
  async function countTotalBtns() {
      let total = findEnterBtns().length;
      broadcast({ type: 'WYU_COUNT' });
      // 简单起见，等 1 秒收集所有回复 (实际上一条回复可能不够，但通常只有一个包含课程的iframe)
      // 为准确起见，我们稍微改动 waitMsg 为收集模式，但为了代码简洁，
      // 这里假设只有一个主要的 iframe 会返回课程数，或者主页面自己有。
      // 鉴于旧代码逻辑，我们简单等待一下
      return new Promise(resolve => {
         let count = total;
         const h = e => { if(e.data?.type === 'WYU_N') count += (e.data.n || 0); };
         window.addEventListener('message', h);
         setTimeout(() => {
             window.removeEventListener('message', h);
             resolve(count);
         }, 1000);
      });
  }

  async function startOneEval() {
    console.log('[主控] 寻找课程入口...');
    // 优先点主页面的
    const localBtns = findEnterBtns();
    if (localBtns.length > 0) {
        localBtns[0].click();
    } else {
        // 让 iframe 点
        broadcast({ type: 'WYU_CLICK' });
        // 等待某个 iframe 说它点了
        await delay(1000); 
    }

    // 等待评教完成消息
    console.log('[主控] 等待评教完成...');
    broadcast({ type: 'WYU_EVAL' }); // 持续广播尝试开始评教，直到有 iframe 响应
    
    // 这里有个技巧：iframe 加载需要时间，我们轮询发送 WYU_EVAL
    const startTime = Date.now();
    let success = false;
    
    while (Date.now() - startTime < 60000) { // 最多等60秒
        const res = await waitMsg('WYU_DONE', 2000); // 等2秒
        if (res && res.result?.success) {
            success = true;
            break;
        }
        // 没收到完成消息，可能是 iframe 还没加载好，或者正在评教中，或者需要再次触发
        // 我们不重复发 WYU_EVAL 以免多次触发，只是一种“握手”会更好
        // 但简单起见，我们假设 iframe 加载好后收到上面那个广播，或者我们每隔几秒广播一次
        broadcast({ type: 'WYU_EVAL' });
    }

    if (success) {
        console.log('[主控] 本轮评教成功，准备刷新...');
        sessionStorage.setItem('WYU_AUTO_FAIL_COUNT', '0'); // 重置失败计数
        await delay(CONFIG.RELOAD_DELAY);
        window.location.reload();
    } else {
        console.error('[主控] 本轮评教超时或失败');
        // 增加失败计数，如果连续失败太多次则停止
        let failCount = parseInt(sessionStorage.getItem('WYU_AUTO_FAIL_COUNT') || '0');
        failCount++;
        sessionStorage.setItem('WYU_AUTO_FAIL_COUNT', failCount.toString());
        
        if (failCount >= 3) {
            alert('连续失败 3 次，自动停止。请检查网络或刷新页面重试。');
            stopAuto();
        } else {
            window.location.reload(); // 刷新重试
        }
    }
  }

  // ============ 自动运行控制 ============

  function stopAuto() {
      sessionStorage.removeItem('WYU_AUTO_RUN');
      sessionStorage.removeItem('WYU_AUTO_FAIL_COUNT');
  }

  async function checkAutoRun() {
      const isAuto = sessionStorage.getItem('WYU_AUTO_RUN') === 'true';
      if (!isAuto) return;

      createPanel(true); // 显示"运行中"面板

      await delay(2000); // 等页面加载稳
      const n = await countTotalBtns();
      if (n === 0) {
          console.log('[主控] 没有剩余课程了');
          stopAuto();
          alert('🎉 全部评教完成！');
          createPanel(false);
          return;
      }

      console.log(`[主控] 剩余 ${n} 个课程，继续评教...`);
      await startOneEval();
  }

  // ============ 界面 ============

  function createPanel(isRunning) {
    document.querySelectorAll('#wyu-panel').forEach(p => p.remove());

    // 读取保存的状态
    const savedPos = JSON.parse(sessionStorage.getItem('WYU_PANEL_POS') || '{"top":"80px","right":"20px"}');
    const isCollapsed = sessionStorage.getItem('WYU_PANEL_COLLAPSED') === 'true';

    const panel = document.createElement('div');
    panel.id = 'wyu-panel';
    // 应用保存的位置
    panel.style.top = savedPos.top;
    panel.style.left = savedPos.left || 'auto';
    panel.style.right = savedPos.left ? 'auto' : savedPos.right;

    panel.innerHTML = `
      <style>
        #wyu-panel {
          position: fixed; z-index: 2147483647;
          background: linear-gradient(135deg, ${isRunning ? '#10b981, #059669' : '#6366f1, #8b5cf6'});
          border-radius: 12px;
          box-shadow: 0 10px 25px rgba(0,0,0,0.3); color: white;
          font-family: sans-serif; transition: width 0.3s, height 0.3s;
          width: ${isCollapsed ? '40px' : '220px'};
          height: ${isCollapsed ? '40px' : 'auto'};
          overflow: hidden;
          padding: ${isCollapsed ? '0' : '16px'};
          cursor: move;
        }
        .btn {
          width: 100%; padding: 10px; border: none; border-radius: 8px;
          background: white; color: ${isRunning ? '#059669' : '#6366f1'};
          font-weight: bold; cursor: pointer; margin-top: 10px;
        }
        .btn:hover { opacity: 0.9; }
        .toggle-btn {
            position: absolute; top: 5px; right: 5px;
            width: 30px; height: 30px; border-radius: 50%;
            border: none; background: rgba(255,255,255,0.2); color: white;
            cursor: pointer; display: flex; align-items: center; justify-content: center;
            font-size: 14px; z-index: 10;
        }
        .toggle-btn:hover { background: rgba(255,255,255,0.3); }
        .content-area {
            opacity: ${isCollapsed ? '0' : '1'};
            transition: opacity 0.2s;
            pointer-events: ${isCollapsed ? 'none' : 'auto'};
        }
        .collapsed-icon {
            position: absolute; top: 0; left: 0; width: 100%; height: 100%;
            display: flex; align-items: center; justify-content: center;
            font-size: 20px; opacity: ${isCollapsed ? '1' : '0'};
            pointer-events: none;
        }
      </style>
      
      <!-- 折叠/展开按钮 -->
      <button class="toggle-btn" title="${isCollapsed ? '展开' : '折叠'}">
        ${isCollapsed ? '＋' : '－'}
      </button>

      <!-- 折叠态图标 -->
      <div class="collapsed-icon">🎓</div>

      <!-- 展开态内容 -->
      <div class="content-area">
        <div style="text-align:center; font-weight:bold; font-size:16px; margin-bottom:5px; margin-right: 20px;">
            ${isRunning ? '🔄 正在评教...' : '🎓 自动评教'}
        </div>
        <div style="text-align:center; font-size:12px; opacity:0.8;">
            ${isRunning ? '评完自动刷新' : '稳定版'}
        </div>
        ${!isRunning ? '<button class="btn" id="wyu-start">🚀 开始评教</button>' : '<button class="btn" id="wyu-stop">⏹ 停止</button>'}
      </div>
    `;
    document.body.appendChild(panel);

    // === 拖动逻辑 ===
    let isDragging = false;
    let startX, startY, initialLeft, initialTop;

    panel.onmousedown = (e) => {
        // 点击按钮时不触发拖动
        if (e.target.tagName === 'BUTTON') return;
        
        isDragging = true;
        startX = e.clientX;
        startY = e.clientY;
        const rect = panel.getBoundingClientRect();
        initialLeft = rect.left;
        initialTop = rect.top;
        panel.style.transition = 'none'; // 拖动时禁用过渡，避免卡顿
    };

    document.onmousemove = (e) => {
        if (!isDragging) return;
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        panel.style.left = `${initialLeft + dx}px`;
        panel.style.top = `${initialTop + dy}px`;
        panel.style.right = 'auto'; // 清除 right，改用 left 定位
    };

    document.onmouseup = () => {
        if (isDragging) {
            isDragging = false;
            panel.style.transition = 'width 0.3s, height 0.3s'; // 恢复过渡
            // 保存位置
            const pos = { top: panel.style.top, left: panel.style.left };
            sessionStorage.setItem('WYU_PANEL_POS', JSON.stringify(pos));
        }
    };

    // === 折叠逻辑 ===
    const toggleBtn = panel.querySelector('.toggle-btn');
    toggleBtn.onclick = (e) => {
        e.stopPropagation(); // 防止触发拖动
        const wasCollapsed = sessionStorage.getItem('WYU_PANEL_COLLAPSED') === 'true';
        const nowCollapsed = !wasCollapsed;
        
        sessionStorage.setItem('WYU_PANEL_COLLAPSED', String(nowCollapsed));
        
        panel.style.width = nowCollapsed ? '40px' : '220px';
        panel.style.height = nowCollapsed ? '40px' : 'auto';
        panel.style.padding = nowCollapsed ? '0' : '16px';
        
        toggleBtn.textContent = nowCollapsed ? '＋' : '－';
        toggleBtn.title = nowCollapsed ? '展开' : '折叠';
        
        panel.querySelector('.content-area').style.opacity = nowCollapsed ? '0' : '1';
        panel.querySelector('.content-area').style.pointerEvents = nowCollapsed ? 'none' : 'auto';
        panel.querySelector('.collapsed-icon').style.opacity = nowCollapsed ? '1' : '0';
    };

    // === 按钮事件 ===
    if (!isRunning) {
        const startBtn = document.getElementById('wyu-start');
        if (startBtn) startBtn.onclick = async () => {
            const n = await countTotalBtns();
            if (n === 0) { alert('没有待评教的课程'); return; }
            if (!confirm(`发现约 ${n} 个课程，将采用"评一个刷新一次"的稳定模式，可能会花点时间，确定开始吗？`)) return;
            
            sessionStorage.setItem('WYU_AUTO_RUN', 'true');
            sessionStorage.setItem('WYU_AUTO_FAIL_COUNT', '0');
            window.location.reload(); 
        };
    } else {
        const stopBtn = document.getElementById('wyu-stop');
        if (stopBtn) stopBtn.onclick = () => {
            stopAuto();
            window.location.reload();
        };
    }
  }

  // 启动
  setTimeout(checkAutoRun, 1000);
  if (sessionStorage.getItem('WYU_AUTO_RUN') !== 'true') {
      setTimeout(() => createPanel(false), 1000);
  }

})();
