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

// 辅助方法：寻找侧边栏的 Avatar 属性行按钮（支持中、英、法文）
window.heygenActions.findAvatarRowButton = function() {
  const subSections = document.querySelectorAll('[data-pacific-component="SceneSubSection"]');
  for (const section of subSections) {
    const header = section.querySelector('.tw-text-textTitle');
    if (header) {
      const text = header.textContent.trim().toLowerCase();
      if (
        text === 'avatar' || 
        text === '头像' || 
        text.includes('avatar') || 
        text.includes('头像')
      ) {
        const rowButton = section.querySelector('[data-pacific-component="SceneRowButton"]');
        if (rowButton) return rowButton;
      }
    }
  }
  
  // 备用方案 1：模糊搜索包含 Ava、Avatar、头像、Look 的 SceneRowButton
  const rowButtons = document.querySelectorAll('[data-pacific-component="SceneRowButton"]');
  for (const btn of rowButtons) {
    const text = btn.textContent.toLowerCase();
    if (
      text.includes('avatar') || 
      text.includes('ava') || 
      text.includes('头像') || 
      text.includes('look')
    ) {
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

// 辅助方法：根据 rowIndex 获取头像库中对应的头像卡片元素
window.heygenActions.findAvatarCardByIndex = function(rowIndex) {
  // 1. 寻找头像库面板容器
  let drawerContainer = null;
  
  // 1.1. 优先通过 SceneAvatarSwitcherHeader 头部组件向上定位
  const headerBtn = document.querySelector('[data-pacific-component="SceneAvatarSwitcherHeader"]');
  if (headerBtn) {
    let current = headerBtn.parentElement;
    while (current && current !== document.body) {
      const style = current.getAttribute('style') || '';
      if (style.includes('1380px') || style.includes('1380') || current.classList.contains('tw-relative')) {
        drawerContainer = current;
        break;
      }
      current = current.parentElement;
    }
    if (!drawerContainer) {
      drawerContainer = headerBtn.closest('.tw-relative') || headerBtn.parentElement?.parentElement;
    }
  }
  
  // 1.2. 备用：通过“Design with AI”等按钮定位（支持中、英、法文）
  if (!drawerContainer) {
    const buttons = document.querySelectorAll('button');
    for (const btn of buttons) {
      const text = btn.textContent || '';
      if (
        text.includes('Design with AI') || 
        text.includes('Upload look') || 
        text.includes('Upload') ||
        text.includes('Concevoir avec') || 
        text.includes('Téléverser')
      ) {
        drawerContainer = btn.closest('div[style*="1380px"]') || btn.closest('div[style*="1380"]') || btn.closest('.tw-relative.tw-size-full') || btn.closest('.tw-relative');
        if (drawerContainer) break;
      }
    }
  }
  
  // 1.3. 再次备用：全局直接找 1380px 的容器
  if (!drawerContainer) {
    drawerContainer = document.querySelector('div[style*="1380px"], div[style*="1380"]');
  }
  
  if (!drawerContainer) {
    console.warn('[HeyGen Automation] 未能定位到头像抽屉容器。');
    return null;
  }
  
  // 2. 找到所有可见的头像图片
  const imgs = Array.from(drawerContainer.querySelectorAll('img')).filter(img => {
    const rect = img.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  });
  
  if (imgs.length === 0) {
    console.warn('[HeyGen Automation] 未在头像抽屉中找到任何可见的 img 元素。');
    return null;
  }
  
  // 3. 寻找最贴近这些图片的网格容器 (Grid Container)
  // 通过统计每个祖先节点包含的图片数和它的 DOM 深度来确定
  const ancestorCounts = new Map();
  const getElementDepth = (el) => {
    let depth = 0, cur = el;
    while (cur) { depth++; cur = cur.parentElement; }
    return depth;
  };
  
  for (const img of imgs) {
    let parent = img.parentElement;
    while (parent && parent !== drawerContainer) {
      ancestorCounts.set(parent, (ancestorCounts.get(parent) || 0) + 1);
      parent = parent.parentElement;
    }
  }
  
  let bestGridContainer = null;
  let maxImgs = 0;
  let maxDepth = 0;
  
  for (const [ancestor, imgCount] of ancestorCounts.entries()) {
    if (imgCount > maxImgs) {
      maxImgs = imgCount;
      bestGridContainer = ancestor;
      maxDepth = getElementDepth(ancestor);
    } else if (imgCount === maxImgs) {
      const depth = getElementDepth(ancestor);
      if (depth > maxDepth) {
        bestGridContainer = ancestor;
        maxDepth = depth;
      }
    }
  }
  
  // 4. 获取网格容器下的子节点作为候选卡片
  let cards = [];
  if (bestGridContainer) {
    cards = Array.from(bestGridContainer.children);
    console.log(`[HeyGen Automation] 智能识别出网格容器，包含子节点数: ${cards.length}, 内部含可见图片数: ${maxImgs}`);
  } else {
    // 兜底旧逻辑
    const allAbsoluteDivs = drawerContainer.querySelectorAll('div.tw-absolute');
    cards = Array.from(allAbsoluteDivs).filter(div => {
      return (div.style.width && div.style.height) || div.querySelector('img');
    });
    console.log(`[HeyGen Automation] 备用方案锁定网格卡片，卡片数: ${cards.length}`);
  }
  
  // 5. 过滤出真正具有头像图片的卡片 (避开 Design with AI, Upload 等纯文字/按钮卡片)
  const avatarCards = cards.filter(card => {
    return !!card.querySelector('img');
  });
  
  console.log(`[HeyGen Automation] 过滤后的头像卡片数量: ${avatarCards.length}`);
  
  if (avatarCards.length === 0) {
    return null;
  }
  
  // 6. 根据 rowIndex 进行选择
  if (rowIndex < avatarCards.length) {
    console.log(`[HeyGen Automation] 场景索引: ${rowIndex}，对应选择第 ${rowIndex} 个头像 (DOM 列表中的第 ${cards.indexOf(avatarCards[rowIndex])} 个子节点)`);
    return avatarCards[rowIndex];
  } else {
    // 超出范围：排除第 0 个头像（对应 rowIndex=0 时跳过保留的那个，即首行手选的头像）
    // 从第 1 个头像开始到最后一个头像之间随机选择
    const minIndex = 1;
    const maxIndex = avatarCards.length - 1;
    
    if (maxIndex >= minIndex) {
      const randomIndex = Math.floor(Math.random() * (maxIndex - minIndex + 1)) + minIndex;
      console.log(`[HeyGen Automation] 场景索引: ${rowIndex} 已超出可用头像数。排除首张（手选头像）后，随机选择头像索引: ${randomIndex}`);
      return avatarCards[randomIndex];
    } else {
      console.log(`[HeyGen Automation] 头像数量不足以排除，只能选择唯一的头像索引 0`);
      return avatarCards[0];
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
  throw new Error(`未在头像抽屉中找到第 ${rowIndex + 1} 行数据对应位置 of 头像卡片。`);
};

// 辅助方法：检查“Avatar Background”属性组件是否已经出现（支持中、英、法文）
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
        text.includes('背景') ||
        text.includes('arrière-plan') || 
        text.includes('fond')
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

// 辅助方法：自动点击返回/关闭按钮，退出头像选择抽屉
window.heygenActions.closeAvatarDrawer = function() {
  const headerBtn = document.querySelector('[data-pacific-component="SceneAvatarSwitcherHeader"]');
  if (!headerBtn) return;
  
  let drawerContainer = null;
  let current = headerBtn.parentElement;
  while (current && current !== document.body) {
    const style = current.getAttribute('style') || '';
    if (style.includes('1380px') || style.includes('1380') || current.classList.contains('tw-relative')) {
      drawerContainer = current;
      break;
    }
    current = current.parentElement;
  }
  if (!drawerContainer) {
    drawerContainer = headerBtn.closest('.tw-relative') || headerBtn.parentElement?.parentElement;
  }
  
  if (!drawerContainer) return;
  
  // 1. 优先查找返回图标（use href="#arrowleft"）
  const useArrowLeft = drawerContainer.querySelector('svg use[href="#arrowleft"], svg use[*|href="#arrowleft"]');
  if (useArrowLeft) {
    const svgEl = useArrowLeft.closest('svg');
    if (svgEl) {
      console.log('[HeyGen Automation] 检测到返回按钮 (#arrowleft)，正在执行物理点击...');
      this.triggerPhysicalClick(svgEl);
      return;
    }
  }
  
  // 2. 兜底查找关闭图标（use href="#close"）
  const useClose = drawerContainer.querySelector('svg use[href="#close"], svg use[*|href="#close"]');
  if (useClose) {
    const svgEl = useClose.closest('svg');
    if (svgEl) {
      console.log('[HeyGen Automation] 检测到关闭按钮 (#close)，正在执行物理点击...');
      this.triggerPhysicalClick(svgEl);
      return;
    }
  }
};

// 核心执行步骤：更换当前场景的头像
window.heygenActions.selectAvatarStep = async function(targetSegment, rowIndex) {
  if (rowIndex === 0) {
    console.log(`[HeyGen Automation] 第一条数据 (Scene 1) 跳过更换头像操作，保持默认头像。`);
    return;
  }
  
  console.log(`[HeyGen Automation] 开始为第 ${rowIndex + 1} 个场景更换头像...`);
  
  // 1. 将场景滚动到视口中央并触发物理点击选中它，以刷新右侧属性面板显示当前场景的属性
  targetSegment.scrollIntoView({ behavior: 'auto', block: 'center' });
  await this.sleep(400); // 滚动等待
  
  console.log(`[HeyGen Automation] 正在物理点击选中第 ${rowIndex + 1} 个场景...`);
  const sceneNum = targetSegment.querySelector('[data-pacific-component="SceneNumber"]');
  if (sceneNum) {
    this.triggerPhysicalClick(sceneNum);
  } else {
    const sceneWrapper = targetSegment.querySelector('[data-scene-id]') || targetSegment;
    this.triggerPhysicalClick(sceneWrapper);
  }
  await this.sleep(500); // 给面板刷新留出足够时间，确保不处于编辑话术的状态下加载
  
  // 2. 利用 Range 选区和 Focus 辅助激活 ProseMirror 编辑器选区，但保留焦点在此行（不调用 inputEl.focus() 以免右侧属性栏自动切换到语音）
  let inputEl = null;
  try {
    inputEl = await this.waitForSegmentInput(rowIndex, 3000);
  } catch (e) {
    console.warn(`[HeyGen Automation] 无法定位到当前场景的输入框，仅采用场景卡片物理激活:`, e);
  }
  
  if (inputEl) {
    console.log(`[HeyGen Automation] 正在同步编辑器光标/选区到第 ${rowIndex + 1} 个场景...`);
    const selection = window.getSelection();
    selection.removeAllRanges();
    const range = document.createRange();
    range.selectNodeContents(inputEl);
    selection.addRange(range);
    
    inputEl.dispatchEvent(new Event('input', { bubbles: true }));
    inputEl.dispatchEvent(new Event('focus', { bubbles: true }));
    await this.sleep(100);
  }
  
  // 留出时间等待右侧属性面板刷新完毕
  console.log(`[HeyGen Automation] 等待 1.2 秒以供属性面板刷新为第 ${rowIndex + 1} 个场景的属性...`);
  await this.sleep(1200);
  
  // 3. 检查头像库抽屉是否已经打开 (可以通过寻找 SceneAvatarSwitcherHeader 头部组件来判断)
  const isDrawerOpen = !!document.querySelector('[data-pacific-component="SceneAvatarSwitcherHeader"]');
  if (isDrawerOpen) {
    console.log(`[HeyGen Automation] 检测到头像面板已经处于打开状态，无需再次点击 Avatar 按钮。`);
  } else {
    const avatarRowBtn = await this.waitForAvatarRowButton(6000);
    console.log(`[HeyGen Automation] 找到 Avatar 按钮，正在触发物理点击...`);
    this.triggerPhysicalClick(avatarRowBtn);
    
    // 等待头像库抽屉完全展开渲染
    console.log(`[HeyGen Automation] 等待头像面板展开 (1.5 秒)...`);
    await this.sleep(1500);
  }
  
  // 4. 定位并点击对应索引位置的头像卡片
  const targetCard = await this.waitForAvatarCard(rowIndex, 10000);
  console.log(`[HeyGen Automation] 成功定位到第 ${rowIndex + 1} 个场景对应的头像卡片。准备进行单次物理点击...`);
  
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
  
  // 确定最终的点击目标 (只进行一次精准物理点击，防止多重点击触发 deselect 或 React 状态冲突)
  let clickTarget = null;
  if (overlay) {
    console.log('[HeyGen Automation] 确定点击卡片遮罩层 div.tw-z-[8]');
    clickTarget = overlay;
  } else if (targetImg) {
    console.log('[HeyGen Automation] 确定点击卡片内部 img 图片');
    clickTarget = targetImg;
  } else if (cardWrapper) {
    console.log('[HeyGen Automation] 确定点击外层卡片容器 .tw-cursor-pointer');
    clickTarget = cardWrapper;
  } else {
    console.log('[HeyGen Automation] 确定点击卡片容器本身');
    clickTarget = targetCard;
  }
  
  this.triggerPhysicalClick(clickTarget);
  
  // 5. 等待头像切换完成（动态检测 Avatar Background 组件是否出现，最长等待 2.5 秒作为安全兜底）
  console.log(`[HeyGen Automation] 已发送点击，正在动态等待 Avatar Background 属性加载完成 (最长 2.5 秒)...`);
  const success = await this.waitForAvatarBackground(2500); // 2.5 秒安全兜底
  if (success) {
    // 检测到成功应用后，额外休眠 300ms 保证 React 状态稳定
    await this.sleep(300);
  }
  
  // 提示：已根据用户手动测试结论，移除了自动返回 closeAvatarDrawer() 调用，让抽屉在各 Scene 执行间保持开启以提升运行效率。
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
      header.textContent.trim() === '运动引擎' ||
      header.textContent.trim().toLowerCase().includes('motion') ||
      header.textContent.trim().toLowerCase().includes('mouvement')
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
