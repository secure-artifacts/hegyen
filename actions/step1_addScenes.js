// 步骤 1: 批量创建场景项目 (Add scene)
// 包含添加按钮定位，以及批量点击的核心逻辑

// 辅助方法：查找“Add scene”的按钮
window.heygenActions.findAddButton = function() {
  // 方案 1: 优先寻找文本内容包含 "Add scene" 的 button 元素
  const buttons = document.querySelectorAll('button');
  for (const btn of buttons) {
    if (btn.textContent && btn.textContent.toLowerCase().includes('add scene')) {
      return btn;
    }
  }
  
  // 方案 2: 寻找带有 #add 图标且最邻近的 button
  const useElement = document.querySelector('svg use[*|href="#add"], svg use[href="#add"]');
  if (useElement) {
    const btn = useElement.closest('button');
    if (btn) return btn;
  }
  
  return null;
};

// 辅助方法：等待“Add scene”按钮在页面渲染出现
window.heygenActions.waitForAddButton = async function(timeout = 10000) {
  const startTime = Date.now();
  while (Date.now() - startTime < timeout) {
    const btn = this.findAddButton();
    if (btn) return btn;
    await this.sleep(100);
  }
  throw new Error('等待“Add scene”按钮超时，请确认页面加载正确且处于项目编辑页。');
};

// 步骤执行入口：连击 N-1 次按钮
window.heygenActions.addScenesStep = async function(totalTasks) {
  const clickCount = totalTasks - 1;
  console.log(`[HeyGen Automation] 开始批量添加项目。总行数: ${totalTasks}，默认已有 1 个，需添加: ${clickCount}`);
  
  if (clickCount > 0) {
    const addButton = await this.waitForAddButton(10000);
    
    for (let i = 0; i < clickCount; i++) {
      console.log(`[HeyGen Automation] [${i + 1}/${clickCount}] 正在点击“Add scene”按钮...`);
      addButton.click();
      
      // 每次点击后等待 0.2s 的冷却时间
      await this.sleep(200);
    }
  }
  
  console.log(`[HeyGen Automation] 已成功创建/分配 ${totalTasks} 个项目槽位。`);
};
