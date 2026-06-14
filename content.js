// Content Script for HeyGen Automation
// 运行在网页环境下的控制端，负责从 background.js 接收指令并触发 actions.js 中的具体操作

console.log('[HeyGen Automation] 自动操作助手内容脚本已注入');

// 页面加载就绪时通知后台
chrome.runtime.sendMessage({ action: 'PAGE_READY' }).catch(err => {
  console.log('[HeyGen Automation] 无法通知后台网页就绪，可能插件未完全加载:', err);
});

// 监听后台指令
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'EXECUTE_ROW') {
    // 异步执行，以便立即回复 background.js "已收到指令"
    (async () => {
      try {
        // 安全检查 actions.js 是否加载成功
        if (!window.heygenActions || typeof window.heygenActions.executeRowAction !== 'function') {
          throw new Error('插件核心操作模块 (actions.js) 未能正确加载，请尝试刷新页面。');
        }
        
        // 执行核心的网页操作步骤
        const result = await window.heygenActions.executeRowAction(
          message.rowData, 
          message.rowIndex, 
          message.totalTasks
        );
        
        // 将成功执行的结果回传给 background.js 推进进度
        chrome.runtime.sendMessage({
          action: 'ROW_FINISHED',
          result: result
        });
        
      } catch (error) {
        console.error('[HeyGen Automation] 自动化执行异常:', error);
        // 将错误报告给后台，暂停队列或报错
        chrome.runtime.sendMessage({
          action: 'ROW_FINISHED',
          error: error.message || '执行过程发生未知错误'
        });
      }
    })();
    
    // 回复后台：已成功接收并开始执行任务
    sendResponse(true);
  } else if (message.action === 'PAUSE' || message.action === 'STOP') {
    console.log('[HeyGen Automation] 收到暂停/停止指令');
    sendResponse(true);
  }
  
  return true; // 保持通道畅通
});
