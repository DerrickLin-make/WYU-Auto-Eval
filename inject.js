(function() {
  // 防止重复提交
  if (window.__WYU_SUBMITTED__) {
    console.log('[评教助手] 已提交，跳过');
    return;
  }
  
  // 🔴 错误拦截：防止网站自身的 "Slider was already initialized" 报错阻断流程
  const _originalError = console.error;
  console.error = function(...args) {
    if (args[0] && typeof args[0] === 'string' && args[0].includes('Slider was already initialized')) {
      return; // 忽略此错误
    }
    _originalError.apply(console, args);
  };

  window.addEventListener('error', function(e) {
    if (e.message && e.message.includes('Slider was already initialized')) {
      e.stopImmediatePropagation();
      e.preventDefault();
      console.log('[评教助手] 拦截并忽略 Slider 重复初始化错误');
      return true;
    }
  }, true);

  console.log('[评教助手] 注入脚本开始执行');
  try {
    if (typeof window.savePj === 'function') {
      console.log('[评教助手] 调用 savePj()');
      window.savePj();
    } else {
      console.error('[评教助手] savePj 函数不存在，尝试查找提交按钮');
      const links = document.querySelectorAll('a');
      let found = false;
      for (const link of links) {
        const onclick = link.getAttribute('onclick');
        if (onclick && onclick.includes('savePj')) {
          window.__WYU_SUBMITTED__ = true;
          console.log('[评教助手] 找到提交按钮');
          try {
            new Function(onclick).call(link);
            found = true;
          } catch(e) {
            link.click();
            found = true;
          }
          break;
        }
      }
      if (!found) {
        console.error('[评教助手] 未找到提交入口');
      }
    }
  } catch(e) {
    console.error('[评教助手] 注入脚本异常:', e);
  }
})();
