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
const closeCreateBtn = document.querySelector("#closeCreateBtn");
const closeReadingListBtn = document.querySelector("#closeReadingListBtn");
const cancelCreateBtn = document.querySelector("#cancelCreateBtn");
const createDrawer = document.querySelector("#createDrawer");
const readingListDrawer = document.querySelector("#readingListDrawer");
const drawerBackdrop = document.querySelector("#drawerBackdrop");
const planCardTemplate = document.querySelector("#planCardTemplate");
const startDateInput = document.querySelector("#startDate");
const goalUnitInput = document.querySelector("#goalUnit");
const snapStepInput = document.querySelector("#snapStep");
const totalPagesInput = document.querySelector("#totalPages");
const chapterCountInput = document.querySelector("#chapterCount");
const generateTrackBtn = document.querySelector("#generateTrackBtn");
const clearNodesBtn = document.querySelector("#clearNodesBtn");
const plannerTrack = document.querySelector("#plannerTrack");
const plannerScale = document.querySelector("#plannerScale");
const plannerHint = document.querySelector("#plannerHint");
const plannerNodes = document.querySelector("#plannerNodes");
const nodeChipList = document.querySelector("#nodeChipList");
const nodeSummary = document.querySelector("#nodeSummary");
const nodePositionsInput = document.querySelector("#nodePositions");

const plannerState = {
  ready: false,
  unit: "pages",
  totalPages: 0,
  snapStep: 1,
  snapValues: [],
  nodeValues: [],
  chapters: [],
};

let activeDrawer = null;
let plans = loadPlans().map(normalizeLoadedPlan);

startDateInput.value = formatDateInput(new Date());
syncSnapHint();
persistPlans();
render();

goalUnitInput.addEventListener("change", () => {
  syncSnapHint();
  resetPlanner("切换了小目标单位，请重新生成节点轨道。");
});
totalPagesInput.addEventListener("input", () => resetPlanner("总页数变了，请重新生成节点轨道。"));
chapterCountInput.addEventListener("input", () => {
  if (goalUnitInput.value === "chapters") {
    resetPlanner("总章节数变了，请重新生成节点轨道。");
  }
});
snapStepInput.addEventListener("input", () => resetPlanner("吸附精度变了，请重新生成节点轨道。"));
openCreateBtn.addEventListener("click", () => openDrawer("create"));
openReadingListBtn.addEventListener("click", () => openDrawer("reading"));
openReadingListBtnAlt.addEventListener("click", () => openDrawer("reading"));
closeCreateBtn.addEventListener("click", closeActiveDrawer);
closeReadingListBtn.addEventListener("click", closeActiveDrawer);
cancelCreateBtn.addEventListener("click", closeActiveDrawer);
drawerBackdrop.addEventListener("click", closeActiveDrawer);
generateTrackBtn.addEventListener("click", generatePlannerTrack);
clearNodesBtn.addEventListener("click", clearPlannerNodes);
plannerTrack.addEventListener("click", handlePlannerTrackClick);

planForm.addEventListener("submit", (event) => {
  event.preventDefault();

  const formData = new FormData(planForm);
  const title = String(formData.get("title") || "").trim();
  const author = String(formData.get("author") || "").trim();
  const totalPages = Number(formData.get("totalPages"));
  const days = Number(formData.get("days"));
  const goalUnit = String(formData.get("goalUnit") || "pages");
  const snapStep = Number(formData.get("snapStep"));
  const chapterCount = Number(formData.get("chapterCount"));
  const startDate = String(formData.get("startDate") || "");
  const theme = String(formData.get("theme") || "amber");
  const notes = String(formData.get("notes") || "").trim();

  if (!title || totalPages <= 0 || days <= 0 || snapStep <= 0 || !startDate) {
    return;
  }

  const chapters = buildChaptersFromCount(totalPages, chapterCount);

  if (goalUnit === "chapters" && chapterCount <= 0) {
    window.alert("按章节拆分时，请先填写总章节数。");
    return;
  }

  if (!plannerState.ready || plannerState.totalPages !== totalPages || plannerState.unit !== goalUnit) {
    window.alert("请先生成节点进度条，再保存这本书。");
    return;
  }

  const plan = buildPlan({
    title,
    author,
    totalPages,
    days,
    goalUnit,
    snapStep,
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
  syncSnapHint();
  resetPlanner("下一本书也可以继续按节点拆分。");
  closeActiveDrawer();
  render();
});

function render() {
  renderSummary();
  renderReadingList();
  renderPlanCards();
}

function renderSummary() {
  activePlansCount.textContent = String(plans.filter((plan) => !isPlanComplete(plan)).length);
  finishedPlansCount.textContent = String(plans.filter((plan) => isPlanComplete(plan)).length);
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
        <div class="reading-item-meta">${plan.currentPage} / ${plan.totalPages} 页 · ${getBookProgressPercent(plan)}%</div>
      </div>
      <span class="stage-progress-badge">${getCurrentTaskProgressPercent(plan)}%</span>
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
    node.querySelector(".plan-theme-tag").textContent = `${theme.label} · ${plan.goalUnit === "pages" ? "按页数" : "按章节"}`;
    node.querySelector(".plan-title").textContent = plan.title;
    node.querySelector(".plan-author").textContent = plan.author || "作者未填写";
    node.querySelector(".plan-notes").textContent = plan.notes || "没有备注，保持轻盈开始阅读。";
    node.querySelector(".book-progress-label").textContent = `${plan.currentPage} / ${plan.totalPages} 页`;
    node.querySelector(".book-progress-percent").textContent = `${bookProgress}%`;
    node.querySelector(".book-progress-fill").style.width = `${bookProgress}%`;
    renderMilestones(milestoneTrack, plan);

    node.querySelector(".plan-stats").innerHTML = `
      <span>${plan.goalUnit === "pages" ? "按页数节点" : "按章节节点"}</span>
      <span>${plan.tasks.length} 个小目标</span>
      <span>还剩 ${Math.max(plan.totalPages - plan.currentPage, 0)} 页</span>
    `;

    node.querySelector(".current-task-title").textContent = currentTask ? "当前小目标进度" : "当前小目标已完成";
    node.querySelector(".current-task-meta").textContent = currentTask
      ? "拖动滑杆即可调整当前小目标完成度，整本书进度会自动同步。"
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

function generatePlannerTrack() {
  const totalPages = Number(totalPagesInput.value);
  const goalUnit = goalUnitInput.value;
  const snapStep = Math.max(Number(snapStepInput.value) || 1, 1);
  const chapterCount = Number(chapterCountInput.value);

  if (totalPages <= 0) {
    window.alert("请先填写总页数。");
    return;
  }

  const chapters = buildChaptersFromCount(totalPages, chapterCount);

  if (goalUnit === "chapters" && chapterCount <= 0) {
    window.alert("按章节拆分时，请先填写总章节数。");
    return;
  }

  const snapValues = goalUnit === "chapters"
    ? getChapterSnapValues(chapters, totalPages)
    : getPageSnapValues(totalPages, snapStep);

  plannerState.ready = true;
  plannerState.unit = goalUnit;
  plannerState.totalPages = totalPages;
  plannerState.snapStep = snapStep;
  plannerState.snapValues = snapValues;
  plannerState.nodeValues = [];
  plannerState.chapters = chapters;
  syncPlannerUI();
}

function handlePlannerTrackClick(event) {
  if (!plannerState.ready) {
    return;
  }

  const rect = plannerTrack.getBoundingClientRect();
  const ratio = clamp((event.clientX - rect.left) / Math.max(rect.width, 1), 0, 1);
  const rawPage = Math.round(ratio * plannerState.totalPages);
  const snappedValue = snapPlannerValue(rawPage, plannerState.snapValues, plannerState.totalPages);

  if (!snappedValue || snappedValue >= plannerState.totalPages || plannerState.nodeValues.includes(snappedValue)) {
    return;
  }

  plannerState.nodeValues = [...plannerState.nodeValues, snappedValue].sort((a, b) => a - b);
  syncPlannerUI();
}

function clearPlannerNodes() {
  plannerState.nodeValues = [];
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
    plannerScale.textContent = "尚未生成节点轨道";
    plannerHint.textContent = "先填写总页数，按章节模式时再填写总章节数，然后在进度条上点击添加节点。";
    nodeSummary.textContent = "默认会按整本书生成 1 个小目标";
    return;
  }

  plannerScale.textContent = plannerState.unit === "chapters"
    ? `共 ${plannerState.chapters.length} 章 · 点击轨道按章节边界吸附`
    : `共 ${plannerState.totalPages} 页 · 每 ${plannerState.snapStep} 页吸附一个节点`;
  plannerHint.textContent = "节点会吸附到页数或章节边界，节点之间自动变成小目标。";
  nodeSummary.textContent = `当前 ${plannerState.nodeValues.length} 个节点，会生成 ${plannerState.nodeValues.length + 1} 个小目标`;

  plannerState.nodeValues.forEach((value, index) => {
    const dot = document.createElement("button");
    dot.type = "button";
    dot.className = "planner-node";
    dot.style.left = `${(value / plannerState.totalPages) * 100}%`;
    dot.title = `删除节点 ${displayPlannerValue(value)}`;
    dot.addEventListener("click", (event) => {
      event.stopPropagation();
      removePlannerNode(value);
    });
    plannerNodes.appendChild(dot);

    const chip = document.createElement("div");
    chip.className = "node-chip";
    chip.innerHTML = `
      <span>${index + 1}. ${displayPlannerValue(value)}</span>
      <button type="button" class="ghost-btn">删除</button>
    `;
    chip.querySelector("button").addEventListener("click", () => removePlannerNode(value));
    nodeChipList.appendChild(chip);
  });

  const endDot = document.createElement("span");
  endDot.className = "planner-node is-end";
  endDot.style.left = "100%";
  plannerNodes.appendChild(endDot);
}

function displayPlannerValue(pageValue) {
  if (plannerState.unit === "chapters") {
    const chapterIndex = plannerState.chapters.findIndex((chapter) => chapter.endPage === pageValue);
    return chapterIndex >= 0 ? `第 ${chapterIndex + 1} 章` : `${pageValue} 页`;
  }
  return `${pageValue} 页`;
}

function buildPlan({ title, author, totalPages, days, goalUnit, snapStep, startDate, theme, notes, chapters, nodeValues }) {
  const normalizedChapters = chapters.length > 0 ? chapters : buildFallbackChapters(totalPages);
  const tasks = buildTasksFromNodes({
    totalPages,
    chapters: normalizedChapters,
    goalUnit,
    nodeValues,
  });

  return syncPlanFromTasks({
    id: crypto.randomUUID(),
    title,
    author,
    totalPages,
    days,
    goalUnit,
    snapStep,
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
          goalUnit: plan.goalUnit || "pages",
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
    goalUnit: plan.goalUnit || "pages",
    snapStep: Number(plan.snapStep) || Number(plan.taskSize) || 1,
    chapters,
    tasks: hydrateTasksFromCurrentPage(normalizedTasks, plan.currentPage || 0),
    completedChapterCount: Number.isFinite(plan.completedChapterCount) ? plan.completedChapterCount : 0,
  });
}

function buildTasksFromNodes({ totalPages, chapters, goalUnit, nodeValues }) {
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
      type: goalUnit,
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

function getChapterSnapValues(chapters, totalPages) {
  const values = chapters.map((chapter) => clamp(chapter.endPage, 1, totalPages)).sort((a, b) => a - b);
  if (values[values.length - 1] !== totalPages) {
    values.push(totalPages);
  }
  return [...new Set(values)];
}

function snapPlannerValue(rawPage, snapValues, totalPages) {
  if (snapValues.length === 0) {
    return clamp(rawPage, 1, totalPages);
  }

  return snapValues.reduce((closest, value) =>
    Math.abs(value - rawPage) < Math.abs(closest - rawPage) ? value : closest
  );
}

function findEndChapterIndex(chapters, endPage) {
  const index = chapters.findIndex((chapter) => chapter.endPage >= endPage);
  return index >= 0 ? index : Math.max(chapters.length - 1, 0);
}

function resetPlanner(message) {
  plannerState.ready = false;
  plannerState.totalPages = 0;
  plannerState.snapValues = [];
  plannerState.nodeValues = [];
  plannerState.chapters = [];
  plannerHint.textContent = message;
  syncPlannerUI();
}

function syncSnapHint() {
  const isPages = goalUnitInput.value === "pages";
  snapStepInput.placeholder = isPages ? "例如 20 页" : "例如 1 章";
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
