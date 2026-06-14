// Background Service Worker for HeyGen Automation
// 使用 chrome.storage.local 实现持久化状态，避免 Service Worker 挂起导致数据丢失

// 默认状态
const DEFAULT_STATE = {
  tasks: [],
  headers: [],
  currentIndex: 0,
  status: 'idle', // 'idle' | 'running' | 'paused' | 'completed'
  isExecuting: false, // 是否有正在执行中的单行任务，防并发冲突
  logs: []
};

// 获取最新状态
async function getState() {
  const result = await chrome.storage.local.get('automationState');
  return result.automationState || { ...DEFAULT_STATE };
}

// 保存状态
async function saveState(state) {
  await chrome.storage.local.set({ automationState: state });
}

// 记录日志并通知 Popup
async function addLog(text, type = 'info') {
  const state = await getState();
  const time = new Date().toLocaleTimeString();
  const logEntry = { time, text, type };
  state.logs.push(logEntry);
  
  // 限制日志条数，防内存泄漏
  if (state.logs.length > 500) {
    state.logs.shift();
  }
  
  await saveState(state);
  
  // 广播日志更新给 popup
  chrome.runtime.sendMessage({ action: 'LOG_ADDED', log: logEntry }).catch(() => {
    // Popup 未打开时会报错，忽略即可
  });
}

// 向页面 Content Script 发送命令
async function sendToActiveTab(message) {
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    // 匹配 HeyGen 页面
    const activeTab = tabs.find(tab => tab.url && tab.url.includes('app.heygen.com'));
    if (activeTab) {
      return await chrome.tabs.sendMessage(activeTab.id, message);
    } else {
      await addLog('未找到处于激活状态的 HeyGen (app.heygen.com) 标签页！', 'error');
      return null;
    }
  } catch (error) {
    console.error('发送消息到网页失败:', error);
    await addLog(`通讯异常: ${error.message}。请确保当前标签页处于 HeyGen 页面且已刷新。`, 'error');
    return null;
  }
}

// 广播状态更新给 Popup
async function broadcastState(state) {
  chrome.runtime.sendMessage({ action: 'STATE_UPDATED', state }).catch(() => {
    // Popup 未打开时忽略
  });
}

// 核心调度：触发当前行任务
async function triggerNextTask() {
  const state = await getState();
  
  if (state.status !== 'running') {
    return;
  }
  
  // 防并发冲突：如果当前已经有任务在网页中执行，则不重复发起
  if (state.isExecuting) {
    console.log('[HeyGen Automation] 任务正在执行中，忽略重复调度指令');
    return;
  }
  
  if (state.currentIndex >= state.tasks.length) {
    state.status = 'completed';
    state.isExecuting = false;
    await saveState(state);
    await addLog('🎉 所有任务均已执行完毕！', 'success');
    broadcastState(state);
    return;
  }
  
  // 标记开始执行
  state.isExecuting = true;
  await saveState(state);
  
  const currentTask = state.tasks[state.currentIndex];
  await addLog(`🔄 开始执行第 ${state.currentIndex + 1} / ${state.tasks.length} 行数据...`, 'info');
  broadcastState(state);
  
  // 向页面发送执行指令
  const success = await sendToActiveTab({
    action: 'EXECUTE_ROW',
    rowData: currentTask,
    rowIndex: state.currentIndex,
    totalTasks: state.tasks.length
  });
  
  if (!success) {
    // 如果发送失败，状态转为暂停，重置执行标记
    state.status = 'paused';
    state.isExecuting = false;
    await saveState(state);
    await addLog('⚠️ 无法与 HeyGen 页面通信，自动化已暂停。请确保你正处于 app.heygen.com 页面。', 'error');
    broadcastState(state);
  }
}

// 监听消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    const state = await getState();
    
    switch (message.action) {
      case 'GET_STATE':
        sendResponse(state);
        break;
        
      case 'START_QUEUE':
        // 开始全新队列
        state.tasks = message.tasks;
        state.headers = message.headers;
        state.currentIndex = 0;
        state.status = 'running';
        state.isExecuting = false; // 重置执行标记
        state.logs = [];
        await saveState(state);
        await addLog(`🚀 启动自动化任务，共导入 ${message.tasks.length} 行数据`, 'info');
        sendResponse({ success: true });
        
        // 延时触发，确保 Popup 接收到回应
        setTimeout(triggerNextTask, 100);
        break;
        
      case 'PAUSE_QUEUE':
        state.status = 'paused';
        state.isExecuting = false; // 重置执行标记
        await saveState(state);
        await addLog('⏸️ 任务已手动暂停。', 'warn');
        broadcastState(state);
        
        // 同时也通知网页端暂停
        sendToActiveTab({ action: 'PAUSE' }).catch(() => {});
        sendResponse({ success: true });
        break;
        
      case 'RESUME_QUEUE':
        if (state.status === 'paused' || state.status === 'completed') {
          state.status = 'running';
          if (state.status === 'completed') {
            state.currentIndex = 0; // 如果已完成，重新开始
          }
          await saveState(state);
          await addLog('▶️ 任务恢复运行。', 'info');
          broadcastState(state);
          setTimeout(triggerNextTask, 100);
        }
        sendResponse({ success: true });
        break;
        
      case 'RESET_QUEUE':
        await saveState(DEFAULT_STATE);
        await addLog('🧹 任务队列已清空重置。', 'info');
        broadcastState(DEFAULT_STATE);
        
        // 通知网页端停止
        sendToActiveTab({ action: 'STOP' }).catch(() => {});
        sendResponse({ success: true });
        break;
        
      case 'ROW_FINISHED':
        // 网页端单行执行完毕的回调
        if (state.status !== 'running') {
          sendResponse({ success: false });
          return;
        }
        
        const { result, error } = message;
        if (result && result.success) {
          await addLog(`✅ 第 ${state.currentIndex + 1} 行执行成功: ${result.message || ''}`, 'success');
        } else {
          await addLog(`❌ 第 ${state.currentIndex + 1} 行执行失败: ${error || '未知错误'}`, 'error');
        }
        
        // 推进到下一行，清空正在执行标记
        state.currentIndex += 1;
        state.isExecuting = false;
        await saveState(state);
        broadcastState(state);
        
        // 触发下一行
        setTimeout(triggerNextTask, 100); // 冷却 0.1s 后执行下一行
        sendResponse({ success: true });
        break;
        
      case 'PAGE_READY':
        // 页面刷新或新页面加载完毕，如果处于 running 状态，重新触发当前任务
        if (state.status === 'running') {
          // 页面重载后，前一次执行肯定中断了，因此强制将 isExecuting 复位以允许重新触发
          state.isExecuting = false;
          await saveState(state);
          await addLog('检测到 HeyGen 页面重载/就绪，正在重新发送当前任务...', 'info');
          setTimeout(triggerNextTask, 1000); // 给页面一些渲染缓冲时间
        }
        sendResponse({ success: true });
        break;
        
      default:
        sendResponse({ error: '未知操作' });
    }
  })();
  
  return true; // 保持异步通道开启
});
