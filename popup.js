// Popup UI logic for HeyGen Automation Assistant

document.addEventListener('DOMContentLoaded', () => {
  // DOM 元素声明
  const tabImportBtn = document.getElementById('tabImportBtn');
  const tabMonitorBtn = document.getElementById('tabMonitorBtn');
  const importSection = document.getElementById('importSection');
  const monitorSection = document.getElementById('monitorSection');
  
  const statusBadge = document.getElementById('statusBadge');
  const statusText = document.getElementById('statusText');
  
  const csvInput = document.getElementById('csvInput');
  const clearInputBtn = document.getElementById('clearInputBtn');
  const parseBtn = document.getElementById('parseBtn');
  
  const previewCard = document.getElementById('previewCard');
  const rowCount = document.getElementById('rowCount');
  const tableHeader = document.getElementById('tableHeader');
  const tableBody = document.getElementById('tableBody');
  const startBtn = document.getElementById('startBtn');
  
  const progressVal = document.getElementById('progressVal');
  const progressBar = document.getElementById('progressBar');
  
  const actionPlayPauseBtn = document.getElementById('actionPlayPauseBtn');
  const playPauseBtnText = document.getElementById('playPauseBtnText');
  const actionResetBtn = document.getElementById('actionResetBtn');
  
  const logTerminal = document.getElementById('logTerminal');
  const clearLogBtn = document.getElementById('clearLogBtn');

  // 解析后的数据变量
  let parsedHeaders = [];
  let parsedRows = [];

  // --- 选项卡切换逻辑 ---
  const tabs = [
    { btn: tabImportBtn, section: importSection },
    { btn: tabMonitorBtn, section: monitorSection }
  ];

  tabs.forEach(tab => {
    tab.btn.addEventListener('click', () => {
      tabs.forEach(t => {
        t.btn.classList.remove('active');
        t.section.classList.remove('active');
      });
      tab.btn.classList.add('active');
      tab.section.classList.add('active');
    });
  });

  function switchTab(targetTabId) {
    const target = tabs.find(t => t.section.id === targetTabId);
    if (target) {
      target.btn.click();
    }
  }

  // --- 粘贴数据解析逻辑 ---
  // 支持从 Google Sheets 复制的制表符分隔值 (TSV)，并且支持单元格内换行（被双引号包裹的情况）
  function parseGoogleSheetsData(text) {
    if (!text || !text.trim()) return null;

    const rows = [];
    let currentCell = '';
    let currentRow = [];
    let inQuotes = false;

    // 逐字符扫描解析 CSV/TSV，以支持单元格内的换行
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      const nextChar = text[i + 1];

      if (char === '"') {
        // 处理双引号转义 "" -> "
        if (inQuotes && nextChar === '"') {
          currentCell += '"';
          i++; // 跳过下一个双引号
        } else {
          // 切换引号状态
          inQuotes = !inQuotes;
        }
      } else if (char === '\t' && !inQuotes) {
        // 未在引号内遇到制表符，说明是单元格边界
        currentRow.push(currentCell.trim());
        currentCell = '';
      } else if ((char === '\r' || char === '\n') && !inQuotes) {
        // 未在引号内遇到换行，说明是行边界
        if (char === '\r' && nextChar === '\n') {
          i++; // 跳过 \n
        }
        currentRow.push(currentCell.trim());
        
        // 过滤全空行
        if (currentRow.some(cell => cell.length > 0)) {
          rows.push(currentRow);
        }
        currentCell = '';
        currentRow = [];
      } else {
        currentCell += char;
      }
    }

    // 收尾最后一个单元格和行
    if (currentCell.trim() || currentRow.length > 0) {
      currentRow.push(currentCell.trim());
      if (currentRow.some(cell => cell.length > 0)) {
        rows.push(currentRow);
      }
    }

    if (rows.length === 0) return null;

    // 如果首行没有制表符，且包含双引号，可能用户只复制了单列的多行文本数据
    // 我们在这里做一次自动适配：如果首行只有一个单元格，那它既是表头也是第一行数据
    let headers = [];
    let dataRows = [];

    // 检测第一行是否包含明细的表头。如果第一行的内容非常长，或者带有引号，说明没有单独的表头行，而是直接为纯数据
    const looksLikeHeader = rows[0].length > 1 || (rows[0][0] && rows[0][0].length < 30 && !rows[0][0].includes('\n'));

    if (looksLikeHeader) {
      headers = rows[0].map(h => h.trim() || '列');
      for (let i = 1; i < rows.length; i++) {
        const rowData = rows[i];
        const rowObj = {};
        headers.forEach((header, index) => {
          rowObj[header] = rowData[index] || '';
        });
        dataRows.push(rowObj);
      }
    } else {
      // 自动生成默认表头 "话术内容"
      headers = ['话术内容'];
      rows.forEach(rowData => {
        // 将整行数据用换行拼合，或者取第一个单元格
        const content = rowData.join('\n').trim();
        if (content) {
          dataRows.push({ '话术内容': content });
        }
      });
    }

    // --- 新增需求：每条话术数据的最后面加上 <break time="0.5s" /> ---
    const scriptKeys = ['script', 'Script', '文本', '脚本', '内容', 'text', 'Text', '话术', '视频话术', '话术内容'];
    dataRows.forEach(rowObj => {
      // 寻找最匹配话术内容的列键
      let matchedKey = null;
      for (const key of scriptKeys) {
        if (rowObj[key] !== undefined) {
          matchedKey = key;
          break;
        }
      }
      // 如果没有找到匹配的键，默认使用第一个键
      if (!matchedKey) {
        const keys = Object.keys(rowObj);
        if (keys.length > 0) {
          matchedKey = keys[0];
        }
      }
      
      if (matchedKey && typeof rowObj[matchedKey] === 'string') {
        const val = rowObj[matchedKey].trim();
        // 避免重复添加
        if (val && !val.endsWith('<break time="0.5s" />')) {
          rowObj[matchedKey] = val + ' <break time="0.5s" />';
        }
      }
    });

    return { headers, rows: dataRows };
  }

  // 点击“解析并预览”
  parseBtn.addEventListener('click', () => {
    const text = csvInput.value;
    if (!text.trim()) {
      alert('请先在输入框中粘贴表格数据！');
      return;
    }
    
    const result = parseGoogleSheetsData(text);
    if (!result || result.rows.length === 0) {
      alert('无法解析数据，请确认您是从 Google 表格或 Excel 复制的数据，且包含表头。');
      return;
    }
    
    parsedHeaders = result.headers;
    parsedRows = result.rows;
    
    // 渲染预览表格
    renderPreviewTable(parsedHeaders, parsedRows);
  });

  // 渲染预览表格
  function renderPreviewTable(headers, rows) {
    rowCount.textContent = rows.length;
    
    // 渲染表头
    tableHeader.innerHTML = '';
    headers.forEach(header => {
      const th = document.createElement('th');
      th.textContent = header;
      tableHeader.appendChild(th);
    });
    
    // 渲染表身 (最多预览 5 行，防止过大卡顿)
    tableBody.innerHTML = '';
    const displayRows = rows.slice(0, 5);
    displayRows.forEach(row => {
      const tr = document.createElement('tr');
      headers.forEach(header => {
        const td = document.createElement('td');
        td.textContent = row[header] || '';
        td.title = row[header] || ''; // 悬停显示完整内容
        tr.appendChild(td);
      });
      tableBody.appendChild(tr);
    });
    
    if (rows.length > 5) {
      const tr = document.createElement('tr');
      const td = document.createElement('td');
      td.setAttribute('colspan', headers.length);
      td.style.textAlign = 'center';
      td.style.color = 'var(--text-muted)';
      td.textContent = `... 还有 ${rows.length - 5} 行数据未在此显示 ...`;
      tr.appendChild(td);
      tableBody.appendChild(tr);
    }
    
    previewCard.classList.remove('hidden');
    // 滚动至预览卡片
    previewCard.scrollIntoView({ behavior: 'smooth' });
  }

  // 清空输入
  clearInputBtn.addEventListener('click', () => {
    csvInput.value = '';
    previewCard.classList.add('hidden');
    parsedHeaders = [];
    parsedRows = [];
  });

  // --- 自动化调度与通信 ---

  // 启动按钮
  startBtn.addEventListener('click', () => {
    if (parsedRows.length === 0) return;
    
    chrome.runtime.sendMessage({
      action: 'START_QUEUE',
      tasks: parsedRows,
      headers: parsedHeaders
    }, (response) => {
      if (response && response.success) {
        switchTab('monitorSection');
        // 初始化时立即拉取一次新状态
        fetchState();
      }
    });
  });

  // 暂停 / 启动切换
  actionPlayPauseBtn.addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: 'GET_STATE' }, (state) => {
      if (!state) return;
      
      const isRunning = state.status === 'running';
      const nextAction = isRunning ? 'PAUSE_QUEUE' : 'RESUME_QUEUE';
      
      chrome.runtime.sendMessage({ action: nextAction }, () => {
        fetchState();
      });
    });
  });

  // 清空重置按钮
  actionResetBtn.addEventListener('click', () => {
    if (confirm('确定要清空当前的运行进度和导入的数据吗？这将停止所有正在执行的自动化流程。')) {
      chrome.runtime.sendMessage({ action: 'RESET_QUEUE' }, () => {
        clearInputBtn.click();
        switchTab('importSection');
        fetchState();
      });
    }
  });

  // 日志管理
  clearLogBtn.addEventListener('click', () => {
    logTerminal.innerHTML = '';
  });

  // 添加单条日志到终端
  function appendLogToTerminal(log) {
    const line = document.createElement('div');
    line.className = `log-line ${log.type || 'info'}`;
    line.textContent = `[${log.time}] ${log.text}`;
    logTerminal.appendChild(line);
    
    // 自动滚动到最下方
    logTerminal.scrollTop = logTerminal.scrollHeight;
  }

  // 重新渲染全部日志
  function renderAllLogs(logs) {
    logTerminal.innerHTML = '';
    if (!logs || logs.length === 0) {
      const line = document.createElement('div');
      line.className = 'log-line system';
      line.textContent = '暂无运行日志。';
      logTerminal.appendChild(line);
      return;
    }
    logs.forEach(log => appendLogToTerminal(log));
  }

  // 更新状态 Badge
  function updateStatusBadge(status) {
    // 移除原有类
    statusBadge.className = 'status-badge';
    
    let text = '未就绪';
    switch (status) {
      case 'idle':
        text = '空闲中';
        statusBadge.classList.add('idle');
        break;
      case 'running':
        text = '自动化中';
        statusBadge.classList.add('running');
        break;
      case 'paused':
        text = '已暂停';
        statusBadge.classList.add('paused');
        break;
      case 'completed':
        text = '执行完成';
        statusBadge.classList.add('completed');
        break;
    }
    statusText.textContent = text;
  }

  // 根据后台返回的状态，更新整个 UI 面板
  function updateUI(state) {
    if (!state) return;
    
    // 1. 更新状态 Badge
    updateStatusBadge(state.status);
    
    // 2. 更新控制按钮禁用状态和文案
    if (state.status === 'idle') {
      actionPlayPauseBtn.disabled = true;
      actionResetBtn.disabled = true;
      playPauseBtnText.textContent = '启动';
      
      // 重置进度
      progressVal.textContent = '0/0 (0%)';
      progressBar.style.width = '0%';
    } else {
      actionPlayPauseBtn.disabled = false;
      actionResetBtn.disabled = false;
      
      const isRunning = state.status === 'running';
      playPauseBtnText.textContent = isRunning ? '暂停' : '启动';
      
      // 修改播放暂停图标的隐藏显示
      const playIcon = actionPlayPauseBtn.querySelector('.icon-play');
      const pauseIcon = actionPlayPauseBtn.querySelector('.icon-pause');
      if (isRunning) {
        playIcon.classList.add('hidden');
        pauseIcon.classList.remove('hidden');
      } else {
        playIcon.classList.remove('hidden');
        pauseIcon.classList.add('hidden');
      }
      
      // 3. 更新进度条
      const total = state.tasks.length || 0;
      const current = state.currentIndex || 0;
      const pct = total > 0 ? Math.round((current / total) * 100) : 0;
      
      progressVal.textContent = `${current}/${total} (${pct}%)`;
      progressBar.style.width = `${pct}%`;
    }
  }

  // 从后台拉取最新状态
  function fetchState() {
    chrome.runtime.sendMessage({ action: 'GET_STATE' }, (state) => {
      if (state) {
        updateUI(state);
        renderAllLogs(state.logs);
        
        // 如果已经在运行或已暂停，且用户停留在导入页面，强制切换到监控页
        if (state.status !== 'idle' && importSection.classList.contains('active')) {
          switchTab('monitorSection');
        }
      }
    });
  }

  // --- 监听来自后台的信息广播 ---
  chrome.runtime.onMessage.addListener((message) => {
    if (message.action === 'STATE_UPDATED') {
      updateUI(message.state);
    } else if (message.action === 'LOG_ADDED') {
      // 如果日志框内目前是“暂无运行日志”，先清空
      if (logTerminal.innerText.includes('暂无运行日志') || logTerminal.innerText.includes('系统已就绪')) {
        logTerminal.innerHTML = '';
      }
      appendLogToTerminal(message.log);
    }
  });

  // 初始化时拉取一次状态
  fetchState();
});
