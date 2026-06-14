// 步骤 3: 为当前 Scene 选择指定的 Avatar 头像
// 动态顺序逻辑：第 i 个数据行对应选择头像列表中的第 i+1 个头像卡片（避开第 0 个 Design with AI/Upload 按钮卡片）

// 辅助方法：对元素触发完整、可信的物理/指针/鼠标点击事件流，并确保滚动到可视区
window.heygenActions.triggerPhysicalClick = function(element) {
  if (!element) return;
  
  // 确保元素滚动到可视区域内，防止点击坐标越界或被遮挡
  if (typeof element.scrollIntoView === 'function') {
    element.scrollIntoView({ behavior: 'auto', block: 'nearest', inline: 'nearest' });
  }
  
  const rect = element.getBoundingClientRect();
  const clientX = rect.left + rect.width / 2;
  const clientY = rect.top + rect.height / 2;
  
  const eventOpts = {
    bubbles: true,
    cancelable: true,
    view: window,
    clientX: clientX,
    clientY: clientY,
    pointerId: 1,
    isPrimary: true
  };
  
  // 1. 发送 Pointer Down / Mouse Down
  element.dispatchEvent(new PointerEvent('pointerdown', eventOpts));
  element.dispatchEvent(new MouseEvent('mousedown', eventOpts));
  
  if (typeof element.focus === 'function') {
    element.focus();
  }
  
  // 2. 发送 Pointer Up / Mouse Up
  element.dispatchEvent(new PointerEvent('pointerup', eventOpts));
  element.dispatchEvent(new MouseEvent('mouseup', eventOpts));
  
  // 3. 发送 Click
  element.dispatchEvent(new MouseEvent('click', eventOpts));
  
  console.log(`[HeyGen Automation] 已成功对元素触发完整物理点击事件链，定位: (${clientX}, ${clientY})`);
};

// 辅助方法：寻找侧边栏的 Avatar 属性行按钮（支持中英文）
window.heygenActions.findAvatarRowButton = function() {
  const subSections = document.querySelectorAll('[data-pacific-component="SceneSubSection"]');
  for (const section of subSections) {
    const header = section.querySelector('.tw-text-textTitle');
    if (header) {
      const text = header.textContent.trim().toLowerCase();
      if (text === 'avatar' || text === '头像') {
        const rowButton = section.querySelector('[data-pacific-component="SceneRowButton"]');
        if (rowButton) return rowButton;
      }
    }
  }
  
  // 备用方案 1：模糊搜索包含 Ava、Avatar 或 头像 的 SceneRowButton
  const rowButtons = document.querySelectorAll('[data-pacific-component="SceneRowButton"]');
  for (const btn of rowButtons) {
    const text = btn.textContent.toLowerCase();
    if (text.includes('avatar') || text.includes('ava') || text.includes('头像')) {
      return btn;
    }
  }
  
  // 备用方案 2：直接选择页面第一个 SceneRowButton
  return document.querySelector('[data-pacific-component="SceneRowButton"]');
};

// 辅助方法：等待 Avatar 属性按钮出现
window.heygenActions.waitForAvatarRowButton = async function(timeout = 6000) {
  const startTime = Date.now();
  while (Date.now() - startTime < timeout) {
    const btn = this.findAvatarRowButton();
    if (btn) return btn;
    await this.sleep(100);
  }
  throw new Error('未在右侧面板中找到 Avatar 头像属性按钮，请确保场景已被选中。');
};

// 辅助方法：根据 rowIndex 获取头像库中对应的头像卡片元素 (rowIndex=0 对应卡片1, 依次类推)
window.heygenActions.findAvatarCardByIndex = function(rowIndex) {
  // 1. 寻找头像库面板容器
  let drawerContainer = null;
  const buttons = document.querySelectorAll('button');
  for (const btn of buttons) {
    if (btn.textContent && (btn.textContent.includes('Design with AI') || btn.textContent.includes('Upload look'))) {
      drawerContainer = btn.closest('div[style*="1380px"]') || btn.closest('div[style*="1380"]') || btn.closest('.tw-relative.tw-size-full');
      if (drawerContainer) break;
    }
  }
  
  if (!drawerContainer) {
    drawerContainer = document.querySelector('div[style*="1380px"], div[style*="1380"]');
  }
  
  if (!drawerContainer) return null;
  
  // 2. 找到该容器下第一层所有的绝对定位卡片
  const cards = Array.from(drawerContainer.querySelectorAll('div.tw-absolute')).filter(div => {
    // 确保是第一级卡片（其直接父元素是 drawerContainer 且带有宽高样式）
    return div.parentElement === drawerContainer && div.style.width && div.style.height;
  });
  
  console.log(`[HeyGen Automation] 找到头像库中的卡片数量: ${cards.length}`);
  
  // 正常顺序索引应该为 rowIndex + 1 (因为第 0 个是 Design with AI 等按钮，第 1 个是首行手选的头像)
  const targetIndex = rowIndex + 1;
  
  if (targetIndex < cards.length) {
    // 还在范围内，按顺序选择卡片
    console.log(`[HeyGen Automation] 场景索引: ${rowIndex}，按顺序映射到头像卡片索引: ${targetIndex} (列表中第 ${targetIndex + 1} 个元素)`);
    return cards[targetIndex];
  } else {
    // 超出范围：排除第 0 个（AI辅助按钮）和第 1 个（即第二个头像，您首行手选的那个）
    // 从第 2 个头像卡片 (index 2) 开始到最后一个卡片之间随机选择
    const minIndex = 2;
    const maxIndex = cards.length - 1;
    
    if (maxIndex >= minIndex) {
      // 随机生成 [minIndex, maxIndex] 之间的整数
      const randomIndex = Math.floor(Math.random() * (maxIndex - minIndex + 1)) + minIndex;
      console.log(`[HeyGen Automation] 场景索引: ${rowIndex} 已超出可用头像数。排除第2张（手选头像）后，随机选择卡片索引: ${randomIndex} (列表中第 ${randomIndex + 1} 个元素)`);
      return cards[randomIndex];
    } else {
      // 兜底：如果列表中只有 2 个元素（Design with AI 和 1 个头像），只能返回这唯一的头像（index 1）
      console.log(`[HeyGen Automation] 头像数量不足以排除，只能选择唯一的头像索引 1`);
      return cards[1];
    }
  }
};

// 辅助方法：等待目标头像卡片渲染出现
window.heygenActions.waitForAvatarCard = async function(rowIndex, timeout = 10000) {
  const startTime = Date.now();
  while (Date.now() - startTime < timeout) {
    const card = this.findAvatarCardByIndex(rowIndex);
    if (card) {
      const rect = card.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        return card;
      }
    }
    await this.sleep(100);
  }
  throw new Error(`未在头像抽屉中找到第 ${rowIndex + 1} 行数据对应位置的头像卡片。`);
};

// 辅助方法：检查“Avatar Background”属性组件是否已经出现（支持中英文）
window.heygenActions.isAvatarBackgroundPresent = function() {
  const subSections = document.querySelectorAll('[data-pacific-component="SceneSubSection"]');
  for (const section of subSections) {
    const header = section.querySelector('.tw-text-textTitle');
    if (header) {
      const text = header.textContent.trim().toLowerCase();
      if (
        text === 'avatar background' || 
        text === '头像背景' || 
        text.includes('background') || 
        text.includes('背景')
      ) {
        const rect = section.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          return true;
        }
      }
    }
  }
  return false;
};

// 辅助方法：等待“Avatar Background”属性组件出现
window.heygenActions.waitForAvatarBackground = async function(timeout = 2500) {
  const startTime = Date.now();
  console.log(`[HeyGen Automation] 开始动态轮询等待“Avatar Background”组件出现，最长等待 ${timeout}ms...`);
  while (Date.now() - startTime < timeout) {
    if (this.isAvatarBackgroundPresent()) {
      console.log(`[HeyGen Automation] 检测到“Avatar Background”组件已成功渲染，头像切换生效！`);
      return true;
    }
    await this.sleep(100);
  }
  console.log(`[HeyGen Automation] 动态轮询检测超时，已达到兜底等待时间 ${timeout}ms。`);
  return false;
};

// 核心执行步骤：更换当前场景的头像
window.heygenActions.selectAvatarStep = async function(targetSegment, rowIndex) {
  if (rowIndex === 0) {
    console.log(`[HeyGen Automation] 第一条数据 (Scene 1) 跳过更换头像操作，保持默认头像。`);
    return;
  }
  
  console.log(`[HeyGen Automation] 开始为第 ${rowIndex + 1} 个场景更换头像...`);
  
  // 1. 将场景滚动到视口中央
  targetSegment.scrollIntoView({ behavior: 'auto', block: 'center' });
  await this.sleep(400); // 滚动等待
  
  // 2. 利用 Range 选区和 Focus 强制更新 ProseMirror 的活动场景
  let inputEl = null;
  try {
    inputEl = await this.waitForSegmentInput(rowIndex, 5000);
  } catch (e) {
    console.warn(`[HeyGen Automation] 无法定位到当前场景的输入框，采用备用激活逻辑:`, e);
  }
  
  if (inputEl) {
    console.log(`[HeyGen Automation] 正在将编辑器光标和选区移至第 ${rowIndex + 1} 个场景...`);
    const editor = document.querySelector('.ProseMirror');
    if (editor) {
      editor.focus();
    }
    
    // 模拟点击输入区
    this.simulateClick(targetSegment);
    inputEl.focus();
    await this.sleep(100);
    
    // 强制设置浏览器 Selection 选区，迫使 ProseMirror 状态管理器将 active 场景切换为当前行
    const selection = window.getSelection();
    selection.removeAllRanges();
    const range = document.createRange();
    range.selectNodeContents(inputEl);
    selection.addRange(range);
    
    // 触发事件让 ProseMirror 确认选区变更
    inputEl.dispatchEvent(new Event('input', { bubbles: true }));
    inputEl.dispatchEvent(new Event('focus', { bubbles: true }));
    await this.sleep(100);
  } else {
    // 兜底激活逻辑
    const sceneNum = targetSegment.querySelector('[data-pacific-component="SceneNumber"]');
    if (sceneNum) {
      this.triggerPhysicalClick(sceneNum);
    } else {
      this.triggerPhysicalClick(targetSegment);
    }
  }
  
  // 留出时间等待右侧属性面板刷新
  console.log(`[HeyGen Automation] 等待 1.5 秒以供属性面板刷新为第 ${rowIndex + 1} 个场景的属性...`);
  await this.sleep(1500); // 增加等待右侧面板刷新的时间到 1.5s
  
  // 3. 寻找并点击 Avatar 行按钮打开头像库面板
  const avatarRowBtn = await this.waitForAvatarRowButton(6000);
  console.log(`[HeyGen Automation] 找到 Avatar 按钮，正在触发物理点击...`);
  this.triggerPhysicalClick(avatarRowBtn);
  
  // 等待头像库抽屉完全展开渲染
  console.log(`[HeyGen Automation] 等待头像面板展开 (1.5 秒)...`);
  await this.sleep(1500); // 增加等待时间至 1.5s
  
  // 4. 定位并点击对应索引位置的头像卡片
  const targetCard = await this.waitForAvatarCard(rowIndex, 10000);
  console.log(`[HeyGen Automation] 成功定位到第 ${rowIndex + 1} 个场景对应的头像卡片。进行多重物理点击以确保生效...`);
  
  // 查找卡片内的 img
  const targetImg = targetCard.querySelector('img');
  
  // 寻找卡片内部用来拦截点击事件的透明遮罩层 div
  const overlays = targetCard.querySelectorAll('div.tw-z-\\[8\\], div[class*="tw-z-[8]"]');
  let overlay = null;
  for (const ov of overlays) {
    if (!ov.classList.contains('tw-pointer-events-none') && !ov.getAttribute('class')?.includes('tw-pointer-events-none')) {
      overlay = ov;
      break;
    }
  }
  
  // 寻找卡片内部具有 cursor-pointer 类的元素
  const cardWrapper = targetCard.querySelector('.tw-cursor-pointer') || targetCard;
  
  // 对这三个可能绑定了点击事件的元素依次发送物理点击，覆盖所有 React 状态绑定的可能性
  if (overlay) {
    console.log('[HeyGen Automation] 点击卡片遮罩层 div.tw-z-[8]');
    this.triggerPhysicalClick(overlay);
    await this.sleep(100);
  }
  
  if (cardWrapper && cardWrapper !== overlay) {
    console.log('[HeyGen Automation] 点击外层卡片容器 .tw-cursor-pointer');
    this.triggerPhysicalClick(cardWrapper);
    await this.sleep(100);
  }
  
  if (targetImg) {
    console.log('[HeyGen Automation] 点击卡片内部 img 图片');
    this.triggerPhysicalClick(targetImg);
  } else {
    // 兜底直接点击整个卡片容器本身
    this.triggerPhysicalClick(targetCard);
  }
  
  // 5. 等待头像切换完成（动态检测 Avatar Background 组件是否出现，最长等待 2.5 秒作为安全兜底）
  console.log(`[HeyGen Automation] 已发送点击，正在动态等待 Avatar Background 属性加载完成 (最长 2.5 秒)...`);
  const success = await this.waitForAvatarBackground(2500); // 2.5 秒安全兜底
  if (success) {
    // 检测到成功应用后，额外休眠 300ms 保证 React 状态稳定
    await this.sleep(300);
  }
  console.log(`[HeyGen Automation] 第 ${rowIndex + 1} 个场景头像更换动作执行完毕。`);
};

// 辅助方法：定位头像模型版本下拉按钮 (定位在 Motion Engine 区块下)
window.heygenActions.findAvatarVersionButton = function() {
  // 1. 寻找带有 data-pacific-component="SceneSubSection" 且标题为 "Motion Engine" 的区块
  const subSections = document.querySelectorAll('[data-pacific-component="SceneSubSection"]');
  for (const section of subSections) {
    const header = section.querySelector('.tw-text-textTitle');
    if (header && (
      header.textContent.trim().toLowerCase() === 'motion engine' || 
      header.textContent.trim() === '动作引擎' || 
      header.textContent.trim() === '运动引擎'
    )) {
      // 在这个区块里寻找下拉按钮 (带有 aria-haspopup="menu" 的 button)
      const button = section.querySelector('button[aria-haspopup="menu"]');
      if (button) return button;
      
      // 备用：返回该区块内的第一个 button
      const fallbackBtn = section.querySelector('button');
      if (fallbackBtn) return fallbackBtn;
    }
  }
  
  // 2. 兜底方案：在全局寻找包含 "Avatar IV" 或 "Avatar III" 文本的下拉按钮
  const buttons = document.querySelectorAll('button[aria-haspopup="menu"]');
  for (const btn of buttons) {
    const text = btn.textContent || '';
    if (text.includes('Avatar IV') || text.includes('Avatar III')) {
      return btn;
    }
  }
  return null;
};

// 辅助方法：获取当前选中的头像版本文本
window.heygenActions.getCurrentAvatarVersion = function(btn) {
  if (!btn) return null;
  const span = btn.querySelector('span.tw-text-textTitle') || btn.querySelector('.tw-text-textTitle') || btn;
  return span ? span.textContent.trim() : null;
};

// 辅助方法：寻找下拉菜单中的 "Avatar III" 选项
window.heygenActions.findAvatarVersionOption = function() {
  const elements = document.querySelectorAll('[role="menuitem"], [role="option"], button, div, span');
  for (const el of elements) {
    if (el.textContent && el.textContent.trim() === 'Avatar III') {
      if (el.getAttribute('aria-haspopup') !== 'menu' && !el.querySelector('svg')) {
        const clickable = el.closest('[role="menuitem"]') || el.closest('button') || el.closest('.tw-cursor-pointer') || el;
        return clickable;
      }
    }
  }
  return null;
};

// 核心执行步骤：自动检查并切换头像模型版本为 Avatar III
window.heygenActions.ensureAvatarVersionStep = async function() {
  console.log(`[HeyGen Automation] 开始前置版本校验 (确保为 Avatar III)...`);
  
  // 1. 确保第 1 个场景被激活并选中，以刷新右侧属性面板，展现 "Motion Engine" 属性
  const segments = document.querySelectorAll('div[data-pacific-component="SegmentComponent"]');
  if (segments && segments.length > 0) {
    const targetSegment = segments[0];
    targetSegment.scrollIntoView({ behavior: 'auto', block: 'center' });
    await this.sleep(200);
    
    // 点击 SceneNumber 选中第 1 个场景
    const sceneNum = targetSegment.querySelector('[data-pacific-component="SceneNumber"]');
    if (sceneNum) {
      this.triggerPhysicalClick(sceneNum);
    } else {
      const sceneWrapper = targetSegment.querySelector('[data-scene-id]') || targetSegment;
      this.triggerPhysicalClick(sceneWrapper);
    }
    
    // 等待右侧属性面板加载刷新完成 (1.2秒)
    await this.sleep(1200);
  }
  
  // 2. 寻找 "Motion Engine" 下的下拉按钮
  let versionBtn = this.findAvatarVersionButton();
  if (!versionBtn) {
    console.log(`[HeyGen Automation] 未能在侧边栏中定位到 "Motion Engine" 版本下拉按钮，跳过本步骤。`);
    return;
  }
  
  const currentVersion = this.getCurrentAvatarVersion(versionBtn);
  console.log(`[HeyGen Automation] 当前 "Motion Engine" 的模型版本为: "${currentVersion}"`);
  
  if (currentVersion && (currentVersion.includes('Avatar III') || currentVersion.includes('Avatar 3'))) {
    console.log(`[HeyGen Automation] 当前已是 Avatar III，无需切换，直接开始。`);
    return;
  }
  
  console.log(`[HeyGen Automation] 检测到当前模型版本不是 Avatar III，正在执行自动切换...`);
  
  // 3. 点击下拉按钮展开菜单
  this.triggerPhysicalClick(versionBtn);
  await this.sleep(800); // 等待下拉列表展开
  
  // 4. 寻找并点击 Avatar III 选项
  const option = this.findAvatarVersionOption();
  if (option) {
    console.log(`[HeyGen Automation] 找到 "Avatar III" 选项，正在触发物理点击切换...`);
    this.triggerPhysicalClick(option);
    await this.sleep(2000); // 留出 2 秒让版本切换刷新生效
    console.log(`[HeyGen Automation] 头像模型版本已成功切换为 Avatar III。`);
  } else {
    console.warn(`[HeyGen Automation] 未在下拉菜单中找到 "Avatar III" 选项，请手动点击。`);
  }
};
