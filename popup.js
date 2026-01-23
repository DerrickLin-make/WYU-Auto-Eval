/**
 * 五邑大学自动评教 - Popup Script
 */

document.addEventListener('DOMContentLoaded', () => {
  const statusEl = document.getElementById('status');
  const runBtn = document.getElementById('runBtn');
  const detectBtn = document.getElementById('detectBtn');

  /**
   * 在当前标签页执行脚本
   */
  async function executeInTab(func) {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      if (!tab) {
        throw new Error('无法获取当前标签页');
      }

      // 检查是否是教务系统页面
      if (!tab.url.includes('wyu.edu.cn')) {
        statusEl.textContent = '⚠️ 请先打开教务系统';
        return null;
      }

      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: func
      });

      return results[0]?.result;
    } catch (error) {
      console.error('执行出错:', error);
      statusEl.textContent = '❌ 执行出错';
      return null;
    }
  }

  /**
   * 一键满分评教
   */
  runBtn.addEventListener('click', async () => {
    statusEl.textContent = '🔄 正在执行...';
    runBtn.disabled = true;

    const result = await executeInTab(() => {
      if (window.wyuAutoEval) {
        return window.wyuAutoEval.run();
      } else {
        return 'not_loaded';
      }
    });

    runBtn.disabled = false;

    if (result === 'not_loaded') {
      statusEl.textContent = '⚠️ 请刷新页面后重试';
    } else if (result === true) {
      statusEl.textContent = '✅ 评教完成！';
    } else if (result === false) {
      statusEl.textContent = '⚠️ 部分完成，请检查';
    } else {
      statusEl.textContent = '❌ 执行失败';
    }
  });

  /**
   * 检测滑块
   */
  detectBtn.addEventListener('click', async () => {
    statusEl.textContent = '🔍 检测中...';

    const result = await executeInTab(() => {
      if (window.wyuAutoEval) {
        const sliders = window.wyuAutoEval.findSliders();
        return sliders.length;
      } else {
        return -1;
      }
    });

    if (result === -1) {
      statusEl.textContent = '⚠️ 请刷新页面后重试';
    } else if (result === 0) {
      statusEl.textContent = '❌ 未找到滑块';
    } else {
      statusEl.textContent = `✅ 找到 ${result} 个滑块`;
    }
  });
});
