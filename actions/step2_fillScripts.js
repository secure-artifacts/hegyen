// 步骤 2: 将表格的数据行依次安全地写入每个 Scene 的话术编辑区中
// 包含精准定位、防偏差滚动、鼠标事件链模拟以及无痕 DOM 文本写入

// 辅助方法：从表格数据行中智能提取出“话术/文本”脚本
window.heygenActions.getScriptText = function(rowData) {
  if (!rowData) return '';
  if (typeof rowData === 'string') return rowData;
  
  const commonKeys = ['script', 'Script', '文本', '脚本', '内容', 'text', 'Text', '话术', '视频话术', '话术内容'];
  for (const key of commonKeys) {
    if (rowData[key] !== undefined && rowData[key] !== null) {
      return String(rowData[key]);
    }
  }
  
  const keys = Object.keys(rowData);
  if (keys.length > 0) {
    return String(rowData[keys[0]]);
  }
  
  return '';
};

// 辅助方法：等待并获取第 rowIndex 个场景输入框元素
window.heygenActions.waitForSegmentInput = async function(rowIndex, timeout = 15000) {
  const startTime = Date.now();
  while (Date.now() - startTime < timeout) {
    const segments = document.querySelectorAll('div[data-pacific-component="SegmentComponent"]');
    if (segments.length > rowIndex) {
      const targetSegment = segments[rowIndex];
      
      let inputEl = targetSegment.querySelector('span[data-node-view-content-react]');
      if (!inputEl) {
        inputEl = targetSegment.querySelector('span[data-node-view-content]');
      }
      if (!inputEl) {
        inputEl = targetSegment.querySelector('[contenteditable="true"]');
      }
      
      if (inputEl) {
        return inputEl;
      }
    }
    await this.sleep(100);
  }
  throw new Error(`等待第 ${rowIndex + 1} 个场景输入框超时。`);
};

// 辅助方法：定位场景容器内最精准的点击中心
window.heygenActions.getClickTarget = function(targetSegment) {
  const divs = targetSegment.querySelectorAll('div');
  for (const div of divs) {
    if (div.style.marginLeft === '48px' || div.getAttribute('style')?.includes('margin-left: 48px')) {
      const rect = div.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        return div;
      }
    }
  }
  const gridDiv = targetSegment.querySelector('div.tw-grid');
  if (gridDiv) return gridDiv;
  
  return targetSegment;
};

// 辅助方法：模拟真实的物理鼠标点击序列，触发 ProseMirror 的 Selection 光标迁移
window.heygenActions.simulateClick = function(targetSegment) {
  const clickTarget = this.getClickTarget(targetSegment);
  const rect = clickTarget.getBoundingClientRect();
  const clientX = rect.left + rect.width / 2;
  const clientY = rect.top + rect.height / 2;
  
  console.log(`[HeyGen Automation] 物理定位点击 Scene 编辑区, 坐标: (${clientX}, ${clientY})`);
  
  const opts = {
    bubbles: true,
    cancelable: true,
    view: window,
    clientX: clientX,
    clientY: clientY
  };
  
  clickTarget.dispatchEvent(new MouseEvent('mousedown', opts));
  clickTarget.dispatchEvent(new MouseEvent('mouseup', opts));
  clickTarget.dispatchEvent(new MouseEvent('click', opts));
};

// 核心写入方法：通过 DOM Node 直接写入（物理隔离），并同步选区和事件让编辑器保存
window.heygenActions.fillContentEditable = async function(targetSegment, element, text) {
  // 1. 将场景滚动到视口中央
  targetSegment.scrollIntoView({ behavior: 'auto', block: 'center' });
  await this.sleep(100); // 缩短到 100ms，快速平稳即可
  
  // 2. 直接对目标的 DOM 元素执行文本重写（100% 物理隔离，绝不会偏离到第一行）
  element.innerHTML = '';
  const textNode = document.createTextNode(text);
  element.appendChild(textNode);
  
  // 3. 聚焦并点击目标，激活 ProseMirror 编辑状态
  const editor = document.querySelector('.ProseMirror');
  if (editor) {
    editor.focus();
  }
  this.simulateClick(targetSegment);
  element.focus();
  await this.sleep(50); // 缩短至 50ms
  
  // 4. 将浏览器选区置于当前文本上
  const selection = window.getSelection();
  selection.removeAllRanges();
  const range = document.createRange();
  range.selectNodeContents(element);
  selection.addRange(range);
  await this.sleep(50); // 缩短至 50ms
  
  // 5. 派发 input 和 change 事件，让 ProseMirror 状态管理器感知并持久化
  element.dispatchEvent(new Event('input', { bubbles: true }));
  element.dispatchEvent(new Event('change', { bubbles: true }));
  
  // 6. 等待更新保存完成
  await this.sleep(150); // 缩短至 150ms（ProseMirror 的 Transaction 响应速度极快，无需等 400ms）
  
  // 7. 清理焦点
  element.blur();
  if (editor) {
    editor.blur();
  }
  element.dispatchEvent(new Event('change', { bubbles: true }));
};
