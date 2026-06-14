// HeyGen 自动化核心操作 - 基础框架与主调度器
// 此文件定义了全局 namespace 结构以及控制每行任务的 executeRowAction 调度器

window.heygenActions = {
  // 辅助函数：延迟等待（毫秒）
  sleep: function(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  },
  
  // 辅助函数：等待页面元素出现
  waitForElement: async function(selector, timeout = 10000) {
    const startTime = Date.now();
    while (Date.now() - startTime < timeout) {
      const element = document.querySelector(selector);
      if (element) return element;
      await this.sleep(100);
    }
    throw new Error(`等待元素超时: ${selector}`);
  },

  /**
   * 核心调度：每次执行一行表格数据时会被触发
   * @param {Object} rowData - 当前行数据（例如: { "话术内容": "..." }）
   * @param {number} rowIndex - 当前行索引（0 开始）
   * @param {number} totalTasks - 导入的数据总行数
   */
  executeRowAction: async function(rowData, rowIndex, totalTasks) {
    console.log(`[HeyGen Automation] 开始处理第 ${rowIndex + 1} 行数据:`, rowData);
    
    // 1. 第一行执行时，运行“步骤 1”：批量创建项目槽位
    if (rowIndex === 0 && typeof this.addScenesStep === 'function') {
      // 在开始添加场景前，先确保版本为 Avatar III
      if (typeof this.ensureAvatarVersionStep === 'function') {
        await this.ensureAvatarVersionStep();
      }
      await this.addScenesStep(totalTasks);
    }
    
    // 2. 运行“步骤 2”：文本话术写入
    const segments = document.querySelectorAll('div[data-pacific-component="SegmentComponent"]');
    const targetSegment = segments[rowIndex];
    
    if (typeof this.waitForSegmentInput === 'function' && typeof this.fillContentEditable === 'function') {
      const inputEl = await this.waitForSegmentInput(rowIndex, 15000);
      const scriptText = this.getScriptText(rowData);
      console.log(`[HeyGen Automation] 正在将文本写入第 ${rowIndex + 1} 个场景: "${scriptText.substring(0, 30)}..."`);
      await this.fillContentEditable(targetSegment, inputEl, scriptText);
    }
    
    // 3. 运行“步骤 3”：更换头像
    if (typeof this.selectAvatarStep === 'function') {
      await this.selectAvatarStep(targetSegment, rowIndex);
    }
    
    // 每行执行完毕后的冷却等待
    await this.sleep(100);
    
    return {
      success: true,
      message: `已成功写入话术并更换了第 ${rowIndex + 1} 个场景的头像。`
    };
  }
};
