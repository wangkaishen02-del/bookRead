const STORAGE_KEY = "chapter-flow-plans";

const themeMap = {
  amber: { label: "琥珀黄", soft: "rgba(217, 119, 6, 0.18)", strong: "#f59e0b" },
  teal: { label: "海盐绿", soft: "rgba(13, 148, 136, 0.18)", strong: "#14b8a6" },
  coral: { label: "珊瑚橘", soft: "rgba(234, 88, 12, 0.18)", strong: "#f97316" },
  ink: { label: "深墨蓝", soft: "rgba(37, 99, 235, 0.18)", strong: "#60a5fa" },
};

const planForm = document.querySelector("#planForm");
const plansGrid = document.querySelector("#plansGrid");
const readingList = document.querySelector("#readingList");
const activePlansCount = document.querySelector("#activePlansCount");
const finishedPlansCount = document.querySelector("#finishedPlansCount");
const openCreateBtn = document.querySelector("#openCreateBtn");
const openReadingListBtn = document.querySelector("#openReadingListBtn");
const openReadingListBtnAlt = document.querySelector("#openReadingListBtnAlt");
const plansSectionBtn = document.querySelector("#plansSectionBtn");
const closeCreateBtn = document.querySelector("#closeCreateBtn");
const closeReadingListBtn = document.querySelector("#closeReadingListBtn");
const cancelCreateBtn = document.querySelector("#cancelCreateBtn");
const createDrawer = document.querySelector("#createDrawer");
const readingListDrawer = document.querySelector("#readingListDrawer");
const drawerBackdrop = document.querySelector("#drawerBackdrop");
const planCardTemplate = document.querySelector("#planCardTemplate");
const startDateInput = document.querySelector("#startDate");
const totalPagesInput = document.querySelector("#totalPages");
const chapterCountInput = document.querySelector("#chapterCount");
const clearNodesBtn = document.querySelector("#clearNodesBtn");
const fillAllNodesBtn = document.querySelector("#fillAllNodesBtn");
const plannerScale = document.querySelector("#plannerScale");
const plannerHint = document.querySelector("#plannerHint");
const plannerNodes = document.querySelector("#plannerNodes");
const nodeChipList = document.querySelector("#nodeChipList");
const nodeSummary = document.querySelector("#nodeSummary");
const nodePositionsInput = document.querySelector("#nodePositions");
const archiveGrid = document.querySelector("#archiveGrid");

const plannerState = {
  ready: false,
  totalPages: 0,
  nodeValues: [],
  chapters: [],
};

let activeDrawer = null;
let plans = loadPlans().map(normalizeLoadedPlan);

startDateInput.value = formatDateInput(new Date());
persistPlans();
render();

totalPagesInput.addEventListener("input", syncPlannerFromInputs);
chapterCountInput.addEventListener("input", syncPlannerFromInputs);
openCreateBtn.addEventListener("click", () => openDrawer("create"));
openReadingListBtn?.addEventListener("click", () => openDrawer("reading"));
openReadingListBtnAlt?.addEventListener("click", () => openDrawer("reading"));
plansSectionBtn?.addEventListener("click", () => {
  document.querySelector("#plansGrid")?.scrollIntoView({ behavior: "smooth", block: "start" });
});
closeCreateBtn?.addEventListener("click", closeActiveDrawer);
closeReadingListBtn?.addEventListener("click", closeActiveDrawer);
cancelCreateBtn?.addEventListener("click", closeActiveDrawer);
drawerBackdrop?.addEventListener("click", closeActiveDrawer);
clearNodesBtn.addEventListener("click", clearPlannerNodes);
fillAllNodesBtn.addEventListener("click", fillAllPlannerNodes);

planForm.addEventListener("submit", (event) => {
  event.preventDefault();

  const formData = new FormData(planForm);
  const title = String(formData.get("title") || "").trim();
  const notes = String(formData.get("notes") || "").trim();
  const totalPages = Number(formData.get("totalPages"));
  const days = Number(formData.get("days"));
  const chapterCount = Number(formData.get("chapterCount"));
  const startDate = String(formData.get("startDate") || "");
  const theme = String(formData.get("theme") || "amber");

  if (!title || totalPages <= 0 || days <= 0 || chapterCount <= 0 || !startDate) {
    return;
  }

  const chapters = buildChaptersFromCount(totalPages, chapterCount);

  if (chapters.length === 0) {
    window.alert("请先填写正确的页数和章节数。");
    return;
  }

  if (!plannerState.ready || plannerState.totalPages !== totalPages || plannerState.chapters.length !== chapterCount) {
    window.alert("请先生成可用的章节轴，再保存这本书。");
    return;
  }

  const plan = buildPlan({
    title,
    totalPages,
    days,
    startDate,
    theme,
    notes,
    chapters,
    nodeValues: plannerState.nodeValues,
  });

  plans = [plan, ...plans];
  persistPlans();
  planForm.reset();
  startDateInput.value = formatDateInput(new Date());
  resetPlanner("下一本书也可以继续按章节点出小目标。");
  closeActiveDrawer();
  render();
});

function render() {
  renderSummary();
  renderReadingList();
  renderPlanCards();
  renderArchiveGrid();
}

function renderSummary() {
  const activePlans = plans.filter((plan) => !isPlanComplete(plan));
  const finishedPlans = plans.filter((plan) => isPlanComplete(plan));

  activePlansCount.textContent = String(activePlans.length);
  finishedPlansCount.textContent = String(finishedPlans.length);
}

function renderReadingList() {
  readingList.innerHTML = "";
  const activePlans = plans.filter((plan) => !isPlanComplete(plan));

  if (activePlans.length === 0) {
    readingList.appendChild(createEmptyState("当前还没有正在读的书。"));
    return;
  }

  activePlans.forEach((plan) => {
    const item = document.createElement("article");
    item.className = "reading-item";
    item.innerHTML = `
      <div>
        <div class="reading-item-title">${escapeHtml(plan.title)}</div>
        <div class="reading-item-meta">${plan.totalPages} 页 · ${plan.chapters.length} 章</div>
      </div>
      <span class="stage-progress-badge">${getBookProgressPercent(plan)}%</span>
    `;
    readingList.appendChild(item);
  });
}

function renderPlanCards() {
  plansGrid.innerHTML = "";
  const activePlans = plans.filter((plan) => !isPlanComplete(plan));

  if (activePlans.length === 0) {
    plansGrid.appendChild(createEmptyState("还没有正在读的书。点右上角“新建一本书”开始吧。"));
    return;
  }

  activePlans.forEach((plan) => {
    const node = planCardTemplate.content.firstElementChild.cloneNode(true);
    const theme = themeMap[plan.theme] || themeMap.amber;
    const bookProgress = getBookProgressPercent(plan);
    const taskProgress = getCurrentTaskProgressPercent(plan);
    const currentTask = getCurrentTask(plan);
    const stageProgressInput = node.querySelector(".stage-progress-input");
    const milestoneTrack = node.querySelector(".milestone-track");

    node.style.setProperty("--accent-soft", theme.soft);
    node.style.setProperty("--accent-strong", theme.strong);
    node.querySelector(".plan-title").textContent = plan.title;
    node.querySelector(".plan-author").textContent = `${formatDisplayDate(plan.startDate)} 开始 · 已过 ${getElapsedDays(plan.startDate)} / ${plan.days} 天`;
    node.querySelector(".plan-notes").textContent = plan.notes || "没有备注，保持轻盈开始阅读。";
    node.querySelector(".section-label").textContent = `整本书进度 · 共 ${plan.totalPages} 页`;
    node.querySelector(".book-progress-label").textContent = "";
    node.querySelector(".book-progress-percent").textContent = "";
    node.querySelector(".book-progress-fill").style.width = `${bookProgress}%`;
    renderMilestones(milestoneTrack, plan);

    node.querySelector(".plan-stats").innerHTML = `
      <span>${plan.chapters.length} 个章节</span>
      <span>${plan.tasks.length} 个小目标</span>
      <span>已完成 ${plan.completedChapterCount} 章</span>
    `;

    node.querySelector(".current-task-title").textContent = currentTask ? "当前小目标进度" : "当前小目标已完成";
    node.querySelector(".current-task-meta").textContent = currentTask
      ? getCurrentTaskChapterRange(plan, currentTask)
      : "所有节点对应的小目标都已完成。";
    node.querySelector(".stage-progress-badge").textContent = `${taskProgress}%`;
    node.querySelector(".stage-progress-value").textContent = `${taskProgress}%`;
    stageProgressInput.value = String(taskProgress);
    stageProgressInput.disabled = !currentTask;

    stageProgressInput.addEventListener("input", () => {
      const nextValue = Number(stageProgressInput.value);
      node.querySelector(".stage-progress-value").textContent = `${nextValue}%`;
      node.querySelector(".stage-progress-badge").textContent = `${nextValue}%`;
    });

    stageProgressInput.addEventListener("change", () => {
      updateCurrentTaskProgress(plan.id, Number(stageProgressInput.value));
    });

    node.querySelector(".delete-btn").addEventListener("click", () => {
      plans = plans.filter((item) => item.id !== plan.id);
      persistPlans();
      render();
    });

    plansGrid.appendChild(node);
  });
}

function renderArchiveGrid() {
  archiveGrid.innerHTML = "";
  const finishedPlans = plans.filter((plan) => isPlanComplete(plan));

  if (finishedPlans.length === 0) {
    archiveGrid.appendChild(createEmptyState("读完的书会显示在这里，慢慢把归档区填满。"));
    return;
  }

  finishedPlans.forEach((plan) => {
    const theme = themeMap[plan.theme] || themeMap.amber;
    const card = document.createElement("article");
    card.className = "archive-card";
    card.style.setProperty("--accent-soft", theme.soft);
    card.style.setProperty("--accent-strong", theme.strong);
    card.innerHTML = `
      <h3 class="archive-title">${escapeHtml(plan.title)}</h3>
      <p class="archive-meta">${plan.totalPages} 页 · ${plan.chapters.length} 章 · ${plan.tasks.length} 个小目标</p>
      <div class="archive-progress">
        <span>完成时间轴</span>
        <strong>${formatDisplayDate(plan.startDate)}</strong>
      </div>
    `;
    archiveGrid.appendChild(card);
  });
}

function openDrawer(kind) {
  closeActiveDrawer();
  activeDrawer = kind;
  drawerBackdrop.classList.remove("hidden");

  if (kind === "create") {
    createDrawer.classList.add("is-open");
    createDrawer.setAttribute("aria-hidden", "false");
  }

  if (kind === "reading") {
    readingListDrawer.classList.add("is-open");
    readingListDrawer.setAttribute("aria-hidden", "false");
  }
}

function closeActiveDrawer() {
  createDrawer.classList.remove("is-open");
  createDrawer.setAttribute("aria-hidden", "true");
  readingListDrawer.classList.remove("is-open");
  readingListDrawer.setAttribute("aria-hidden", "true");
  drawerBackdrop.classList.add("hidden");
  activeDrawer = null;
}

function syncPlannerFromInputs() {
  const totalPages = Number(totalPagesInput.value);
  const chapterCount = Number(chapterCountInput.value);

  if (totalPages <= 0 || chapterCount <= 0) {
    resetPlanner("填写页数和章节数后，会自动生成章节轴。");
    return;
  }

  const chapters = buildChaptersFromCount(totalPages, chapterCount);

  plannerState.ready = true;
  plannerState.totalPages = totalPages;
  plannerState.nodeValues = plannerState.nodeValues.filter((value) => value > 0 && value < totalPages);
  plannerState.chapters = chapters;
  syncPlannerUI();
}

function clearPlannerNodes() {
  plannerState.nodeValues = [];
  syncPlannerUI();
}

function fillAllPlannerNodes() {
  if (!plannerState.ready) {
    return;
  }

  plannerState.nodeValues = plannerState.chapters
    .slice(0, -1)
    .map((chapter) => chapter.endPage);
  syncPlannerUI();
}

function togglePlannerNode(value) {
  if (value >= plannerState.totalPages) {
    return;
  }

  plannerState.nodeValues = plannerState.nodeValues.includes(value)
    ? plannerState.nodeValues.filter((item) => item !== value)
    : [...plannerState.nodeValues, value].sort((a, b) => a - b);
  syncPlannerUI();
}

function removePlannerNode(value) {
  plannerState.nodeValues = plannerState.nodeValues.filter((item) => item !== value);
  syncPlannerUI();
}

function syncPlannerUI() {
  nodePositionsInput.value = plannerState.nodeValues.join(",");
  plannerNodes.innerHTML = "";
  nodeChipList.innerHTML = "";

  if (!plannerState.ready) {
    plannerScale.textContent = "尚未生成章节轴";
    plannerHint.textContent = "填写页数和章节数后，会自动生成可点击的章节节点。";
    nodeSummary.textContent = "默认会按整本书生成 1 个小目标";
    return;
  }

  plannerScale.textContent = `共 ${plannerState.chapters.length} 章 · 点击任意章节节点，就能把它设成一个小目标终点`;
  plannerHint.textContent = "例如点亮第 3 章和第 7 章，系统会自动拆成 3 段阅读任务。";
  nodeSummary.textContent = `当前 ${plannerState.nodeValues.length} 个节点，会生成 ${plannerState.nodeValues.length + 1} 个小目标`;
  fillAllNodesBtn.disabled = plannerState.chapters.length <= 1;

  plannerState.chapters.forEach((chapter, index) => {
    const value = chapter.endPage;
    const isEnd = index === plannerState.chapters.length - 1;
    const isSelected = plannerState.nodeValues.includes(value);
    const dot = document.createElement("button");
    dot.type = "button";
    dot.className = `planner-node${isSelected ? " is-selected" : ""}${isEnd ? " is-end" : ""}`;
    dot.style.left = `${(value / plannerState.totalPages) * 100}%`;
    dot.dataset.label = `${index + 1}`;
    dot.title = isEnd ? `第 ${index + 1} 章 · 全书终点` : `${isSelected ? "取消" : "设为"}第 ${index + 1} 章小目标`;
    dot.addEventListener("click", (event) => {
      event.stopPropagation();
      togglePlannerNode(value);
    });
    plannerNodes.appendChild(dot);
  });

  plannerState.nodeValues.forEach((value, index) => {
    const chip = document.createElement("div");
    chip.className = "node-chip";
    chip.innerHTML = `
      <span>${index + 1}. ${displayPlannerValue(value)} 设为小目标</span>
      <button type="button" class="ghost-btn">取消</button>
    `;
    chip.querySelector("button").addEventListener("click", () => removePlannerNode(value));
    nodeChipList.appendChild(chip);
  });
}

function displayPlannerValue(pageValue) {
  const chapterIndex = plannerState.chapters.findIndex((chapter) => chapter.endPage === pageValue);
  return chapterIndex >= 0 ? `第 ${chapterIndex + 1} 章` : `${pageValue} 页`;
}

function buildPlan({ title, totalPages, days, startDate, theme, notes, chapters, nodeValues }) {
  const normalizedChapters = chapters.length > 0 ? chapters : buildFallbackChapters(totalPages);
  const tasks = buildTasksFromNodes({
    totalPages,
    chapters: normalizedChapters,
    nodeValues,
  });

  return syncPlanFromTasks({
    id: crypto.randomUUID(),
    title,
    totalPages,
    days,
    goalUnit: "chapters",
    startDate,
    theme,
    notes,
    chapters: normalizedChapters,
    tasks: tasks.map((task) => ({
      ...task,
      progress: 0,
      done: false,
    })),
    currentPage: 0,
    completedChapterCount: 0,
    createdAt: new Date().toISOString(),
  });
}

function normalizeLoadedPlan(plan) {
  const totalPages = Number(plan.totalPages) || 0;
  const chapters = Array.isArray(plan.chapters) && plan.chapters.length > 0 ? plan.chapters : buildFallbackChapters(totalPages);
  const normalizedTasks = Array.isArray(plan.tasks) && plan.tasks.length > 0
    ? (plan.tasks || []).map((task) => ({
        ...task,
        progress: Number.isFinite(task.progress) ? clamp(task.progress, 0, 100) : task.done ? 100 : 0,
      }))
    : hydrateTasksFromCurrentPage(
        buildTasksFromNodes({
          totalPages,
          chapters,
          nodeValues: [],
        }).map((task) => ({
          ...task,
          progress: 0,
          done: false,
        })),
        plan.currentPage || 0
      );

  return syncPlanFromTasks({
    ...plan,
    goalUnit: "chapters",
    chapters,
    tasks: hydrateTasksFromCurrentPage(normalizedTasks, plan.currentPage || 0),
    completedChapterCount: Number.isFinite(plan.completedChapterCount) ? plan.completedChapterCount : 0,
  });
}

function buildTasksFromNodes({ totalPages, chapters, nodeValues }) {
  const boundaries = [...new Set(nodeValues)]
    .filter((value) => value > 0 && value < totalPages)
    .sort((a, b) => a - b);
  const taskEnds = [...boundaries, totalPages];
  const tasks = [];
  let startPage = 1;

  taskEnds.forEach((endPage, index) => {
    const chapterCount = getCoveredChapterCount(chapters, startPage, endPage);
    const startChapterIndex = chapters.findIndex((chapter) => chapter.endPage >= startPage);
    const endChapterIndex = findEndChapterIndex(chapters, endPage);

    tasks.push({
      id: crypto.randomUUID(),
      title: `小目标 ${index + 1}`,
      type: "chapters",
      startPage,
      endPage,
      chapterCount,
      startChapterIndex,
      endChapterIndex,
    });
    startPage = endPage + 1;
  });

  return tasks;
}

function buildChaptersFromCount(totalPages, chapterCount) {
  if (!Number.isFinite(chapterCount) || chapterCount <= 0 || totalPages <= 0) {
    return [];
  }

  return Array.from({ length: chapterCount }, (_, index) => ({
    title: `第 ${index + 1} 章`,
    startPage: inferChapterStart(index, chapterCount, totalPages),
    endPage: inferChapterEnd(index, chapterCount, totalPages),
  }));
}

function buildFallbackChapters(totalPages) {
  return [{ title: "全书", startPage: 1, endPage: totalPages }];
}

function updateCurrentTaskProgress(planId, nextProgress) {
  plans = plans.map((plan) => {
    if (plan.id !== planId) {
      return plan;
    }

    const currentTask = getCurrentTask(plan);
    if (!currentTask) {
      return plan;
    }

    const progress = clamp(nextProgress, 0, 100);
    const tasks = plan.tasks.map((task) => {
      if (task.done) {
        return { ...task, progress: 100 };
      }
      if (task.id !== currentTask.id) {
        return { ...task, progress: 0 };
      }
      return { ...task, progress, done: progress >= 100 };
    });

    return syncPlanFromTasks({ ...plan, tasks });
  });

  persistPlans();
  render();
}

function syncPlanFromTasks(plan) {
  const completedTasks = plan.tasks.filter((task) => task.done);
  const currentTask = getCurrentTask(plan);
  const completedPages = completedTasks.reduce((sum, task) => sum + getTaskPageSpan(task), 0);
  const currentTaskPages = currentTask ? Math.round((getTaskPageSpan(currentTask) * clamp(currentTask.progress || 0, 0, 100)) / 100) : 0;
  const currentPage = clamp(completedPages + currentTaskPages, 0, plan.totalPages);

  return {
    ...plan,
    currentPage,
    completedChapterCount: inferCompletedChapterCount({
      ...plan,
      currentPage,
    }),
    tasks: plan.tasks.map((task) => ({
      ...task,
      progress: task.done ? 100 : clamp(task.progress || 0, 0, 100),
    })),
  };
}

function inferCompletedChapterCount(plan) {
  return plan.chapters.filter((chapter) => chapter.endPage <= plan.currentPage).length;
}

function isPlanComplete(plan) {
  return plan.currentPage >= plan.totalPages || plan.tasks.every((task) => task.done);
}

function getCurrentTask(plan) {
  return plan.tasks.find((task) => !task.done) || null;
}

function getBookProgressPercent(plan) {
  return Math.round((plan.currentPage / Math.max(plan.totalPages, 1)) * 100);
}

function getCurrentTaskProgressPercent(plan) {
  const currentTask = getCurrentTask(plan);
  return currentTask ? clamp(Math.round(currentTask.progress || 0), 0, 100) : 100;
}

function getCurrentTaskChapterRange(plan, task) {
  const startChapter = plan.chapters[clamp(task.startChapterIndex, 0, plan.chapters.length - 1)]?.title;
  const endChapter = plan.chapters[clamp(task.endChapterIndex, 0, plan.chapters.length - 1)]?.title;

  if (startChapter && endChapter) {
    return `${startChapter} - ${endChapter}`;
  }

  return "当前目标章节范围";
}

function getCoveredChapterCount(chapters, startPage, endPage) {
  return chapters.filter((chapter) => chapter.endPage >= startPage && chapter.startPage <= endPage).length;
}

function getTaskPageSpan(task) {
  return Math.max(task.endPage - task.startPage + 1, 0);
}

function renderMilestones(container, plan) {
  container.innerHTML = "";
  const currentTask = getCurrentTask(plan);

  plan.tasks.forEach((task, index) => {
    const dot = document.createElement("span");
    dot.className = `milestone-dot${task.done ? " is-done" : ""}${currentTask?.id === task.id ? " is-current" : ""}`;
    dot.style.left = `${Math.min((task.endPage / plan.totalPages) * 100, 100)}%`;
    dot.title = `小目标 ${index + 1}`;
    container.appendChild(dot);
  });
}

function hydrateTasksFromCurrentPage(tasks, currentPage) {
  let remainingPages = clamp(currentPage, 0, Number.MAX_SAFE_INTEGER);

  return tasks.map((task) => {
    const span = getTaskPageSpan(task);
    if (remainingPages <= 0) {
      return { ...task, done: false, progress: 0 };
    }
    if (remainingPages >= span) {
      remainingPages -= span;
      return { ...task, done: true, progress: 100 };
    }
    const progress = Math.round((remainingPages / span) * 100);
    remainingPages = 0;
    return { ...task, done: progress >= 100, progress };
  });
}

function getPageSnapValues(totalPages, snapStep) {
  const values = [];
  for (let value = snapStep; value <= totalPages; value += snapStep) {
    values.push(Math.min(value, totalPages));
  }
  if (values[values.length - 1] !== totalPages) {
    values.push(totalPages);
  }
  return values;
}

function findEndChapterIndex(chapters, endPage) {
  const index = chapters.findIndex((chapter) => chapter.endPage >= endPage);
  return index >= 0 ? index : Math.max(chapters.length - 1, 0);
}

function resetPlanner(message) {
  plannerState.ready = false;
  plannerState.totalPages = 0;
  plannerState.nodeValues = [];
  plannerState.chapters = [];
  plannerHint.textContent = message;
  syncPlannerUI();
}

function loadPlans() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function persistPlans() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(plans));
}

function createEmptyState(message) {
  const div = document.createElement("div");
  div.className = "empty-state";
  div.textContent = message;
  return div;
}

function formatDateInput(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDisplayDate(value) {
  if (!value) {
    return "今天";
  }
  const [year, month, day] = String(value).split("-");
  if (!year || !month || !day) {
    return value;
  }
  return `${year}.${month}.${day}`;
}

function getElapsedDays(startDate) {
  if (!startDate) {
    return 0;
  }

  const start = new Date(`${startDate}T00:00:00`);
  if (Number.isNaN(start.getTime())) {
    return 0;
  }

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diff = today.getTime() - start.getTime();
  return Math.max(Math.floor(diff / (1000 * 60 * 60 * 24)), 0);
}

function inferChapterStart(index, totalCount, totalPages) {
  return Math.floor((index / totalCount) * totalPages) + 1;
}

function inferChapterEnd(index, totalCount, totalPages) {
  return Math.max(Math.floor(((index + 1) / totalCount) * totalPages), inferChapterStart(index, totalCount, totalPages));
}

function clamp(value, min, max) {
  return Math.min(Math.max(Number.isFinite(value) ? value : min, min), max);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
