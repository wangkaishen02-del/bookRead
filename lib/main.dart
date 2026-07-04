import 'dart:convert';
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

const _storageKey = 'flutter-bookread-plans';

void main() {
  runApp(const BookReadApp());
}

class BookReadApp extends StatelessWidget {
  const BookReadApp({super.key});

  @override
  Widget build(BuildContext context) {
    const seed = Color(0xFFC86B35);

    return MaterialApp(
      title: 'BookRead',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        useMaterial3: true,
        colorScheme: ColorScheme.fromSeed(seedColor: seed, brightness: Brightness.light),
        scaffoldBackgroundColor: const Color(0xFFF6EFE4),
        cardTheme: const CardThemeData(
          color: Color(0xFFFFFBF6),
          elevation: 0,
          margin: EdgeInsets.zero,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.all(Radius.circular(28)),
          ),
        ),
      ),
      home: const BookDashboardPage(),
    );
  }
}

class BookDashboardPage extends StatefulWidget {
  const BookDashboardPage({super.key});

  @override
  State<BookDashboardPage> createState() => _BookDashboardPageState();
}

class _BookDashboardPageState extends State<BookDashboardPage> {
  final List<BookPlan> _plans = [];
  bool _loaded = false;

  @override
  void initState() {
    super.initState();
    _loadPlans();
  }

  Future<void> _loadPlans() async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(_storageKey);
    if (raw != null && raw.isNotEmpty) {
      final decoded = jsonDecode(raw) as List<dynamic>;
      _plans
        ..clear()
        ..addAll(decoded.map((item) => BookPlan.fromJson(item as Map<String, dynamic>)));
    }
    if (!mounted) {
      return;
    }
    setState(() {
      _loaded = true;
    });
  }

  Future<void> _savePlans() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(
      _storageKey,
      jsonEncode(_plans.map((plan) => plan.toJson()).toList()),
    );
  }

  Future<void> _openCreateDialog() async {
    final plan = await showDialog<BookPlan>(
      context: context,
      barrierDismissible: true,
      builder: (context) => const CreateBookDialog(),
    );

    if (plan == null) {
      return;
    }

    setState(() {
      _plans.insert(0, plan);
    });
    await _savePlans();
  }

  Future<void> _deletePlan(String id) async {
    setState(() {
      _plans.removeWhere((plan) => plan.id == id);
    });
    await _savePlans();
  }

  Future<void> _updatePlan(BookPlan nextPlan) async {
    final index = _plans.indexWhere((plan) => plan.id == nextPlan.id);
    if (index == -1) {
      return;
    }

    setState(() {
      _plans[index] = nextPlan;
    });
    await _savePlans();
  }

  @override
  Widget build(BuildContext context) {
    final activePlans = _plans.where((plan) => !plan.isComplete).length;
    final finishedPlans = _plans.where((plan) => plan.isComplete).length;

    return Scaffold(
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _openCreateDialog,
        icon: const Icon(Icons.add_rounded),
        label: const Text('新建一本书'),
      ),
      body: SafeArea(
        child: _loaded
            ? CustomScrollView(
                slivers: [
                  SliverPadding(
                    padding: const EdgeInsets.fromLTRB(20, 20, 20, 96),
                    sliver: SliverList(
                      delegate: SliverChildListDelegate(
                        [
                          _HeroHeader(
                            activePlans: activePlans,
                            finishedPlans: finishedPlans,
                            onCreatePressed: _openCreateDialog,
                          ),
                          const SizedBox(height: 20),
                          if (_plans.isEmpty)
                            const _EmptyState()
                          else
                            ..._plans.map(
                              (plan) => Padding(
                                padding: const EdgeInsets.only(bottom: 16),
                                child: BookPlanCard(
                                  plan: plan,
                                  onChanged: _updatePlan,
                                  onDelete: () => _deletePlan(plan.id),
                                ),
                              ),
                            ),
                        ],
                      ),
                    ),
                  ),
                ],
              )
            : const Center(child: CircularProgressIndicator()),
      ),
    );
  }
}

class _HeroHeader extends StatelessWidget {
  const _HeroHeader({
    required this.activePlans,
    required this.finishedPlans,
    required this.onCreatePressed,
  });

  final int activePlans;
  final int finishedPlans;
  final VoidCallback onCreatePressed;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;

    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(32),
        gradient: const LinearGradient(
          colors: [Color(0xFFFFF7EC), Color(0xFFF0E3CF)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        boxShadow: const [
          BoxShadow(
            color: Color(0x14000000),
            blurRadius: 24,
            offset: Offset(0, 12),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'BookRead',
            style: Theme.of(context).textTheme.labelLarge?.copyWith(
                  color: const Color(0xFF995127),
                  letterSpacing: 1.2,
                  fontWeight: FontWeight.w700,
                ),
          ),
          const SizedBox(height: 8),
          Text(
            '把读书计划变成稳定、可推进的小目标',
            style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                  fontWeight: FontWeight.w800,
                  color: const Color(0xFF2C2018),
                ),
          ),
          const SizedBox(height: 10),
          Text(
            '用更主流的 Flutter 方案重做后，页面、弹窗、节点点击和 Android 运行链路都会简单很多。',
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  color: const Color(0xFF735E4E),
                  height: 1.5,
                ),
          ),
          const SizedBox(height: 20),
          Row(
            children: [
              Expanded(
                child: _SummaryPill(
                  label: '正在读',
                  value: '$activePlans',
                  accent: scheme.primary,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: _SummaryPill(
                  label: '已完成',
                  value: '$finishedPlans',
                  accent: const Color(0xFF1E8C6A),
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          FilledButton.icon(
            onPressed: onCreatePressed,
            icon: const Icon(Icons.auto_stories_rounded),
            label: const Text('添加阅读计划'),
          ),
        ],
      ),
    );
  }
}

class _SummaryPill extends StatelessWidget {
  const _SummaryPill({
    required this.label,
    required this.value,
    required this.accent,
  });

  final String label;
  final String value;
  final Color accent;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 16),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.72),
        borderRadius: BorderRadius.circular(24),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label,
            style: Theme.of(context).textTheme.labelLarge?.copyWith(
                  color: const Color(0xFF7B6758),
                ),
          ),
          const SizedBox(height: 8),
          Text(
            value,
            style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                  color: accent,
                  fontWeight: FontWeight.w800,
                ),
          ),
        ],
      ),
    );
  }
}

class _EmptyState extends StatelessWidget {
  const _EmptyState();

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(28),
        child: Column(
          children: [
            const Icon(Icons.menu_book_rounded, size: 48, color: Color(0xFFC86B35)),
            const SizedBox(height: 16),
            Text(
              '还没有阅读计划',
              style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w800),
            ),
            const SizedBox(height: 8),
            Text(
              '点右下角的新建按钮，输入书名、总页数、章节数和计划天数，就能生成一套稳定可点的阶段节点。',
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: const Color(0xFF746456),
                    height: 1.6,
                  ),
            ),
          ],
        ),
      ),
    );
  }
}

class BookPlanCard extends StatelessWidget {
  const BookPlanCard({
    required this.plan,
    required this.onChanged,
    required this.onDelete,
    super.key,
  });

  final BookPlan plan;
  final ValueChanged<BookPlan> onChanged;
  final VoidCallback onDelete;

  @override
  Widget build(BuildContext context) {
    final currentTask = plan.focusedTask;
    final bookProgress = plan.bookProgressPercent;
    final taskProgress = currentTask == null ? 100 : plan.progressByTask[plan.focusedTaskIndex];
    final accent = plan.theme.color;

    return Card(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(20, 18, 20, 20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        plan.title,
                        style: Theme.of(context).textTheme.titleLarge?.copyWith(
                              fontWeight: FontWeight.w800,
                              color: const Color(0xFF2C2018),
                            ),
                      ),
                      const SizedBox(height: 6),
                      Text(
                        '${formatDate(plan.startDate)} 开始 · 已过 ${plan.elapsedDays} / ${plan.plannedDays} 天',
                        style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                              color: const Color(0xFF746456),
                            ),
                      ),
                    ],
                  ),
                ),
                IconButton(
                  onPressed: onDelete,
                  icon: const Icon(Icons.close_rounded),
                  tooltip: '删除',
                ),
              ],
            ),
            if (plan.notes.isNotEmpty) ...[
              const SizedBox(height: 12),
              Text(
                plan.notes,
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                      color: const Color(0xFF6E5B4B),
                      height: 1.5,
                    ),
              ),
            ],
            const SizedBox(height: 18),
            _ProgressSection(
              label: '整本书进度 · 共 ${plan.totalPages} 页',
              progress: bookProgress / 100,
              accent: accent,
              trailing: '${bookProgress.toStringAsFixed(0)}%',
            ),
            const SizedBox(height: 18),
            Wrap(
              spacing: 10,
              runSpacing: 10,
              children: [
                _InfoBadge(icon: Icons.layers_rounded, label: '${plan.chapterCount} 章'),
                _InfoBadge(icon: Icons.flag_rounded, label: '${plan.tasks.length} 个阶段'),
                _InfoBadge(icon: Icons.check_circle_rounded, label: '完成 ${plan.completedTaskCount} 个'),
              ],
            ),
            const SizedBox(height: 18),
            Text(
              currentTask == null ? '全部小目标已完成' : '当前小目标进度',
              style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800),
            ),
            const SizedBox(height: 6),
            Text(
              currentTask == null
                  ? '这本书的所有阶段都完成了。'
                  : '当前目标：第 ${currentTask.startChapter} 章 - 第 ${currentTask.endChapter} 章',
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: const Color(0xFF746456),
                  ),
            ),
            const SizedBox(height: 10),
            Row(
              children: [
                Expanded(
                  child: SliderTheme(
                    data: SliderTheme.of(context).copyWith(
                      activeTrackColor: accent,
                      inactiveTrackColor: accent.withValues(alpha: 0.18),
                      thumbColor: accent,
                      overlayColor: accent.withValues(alpha: 0.14),
                    ),
                    child: Slider(
                      value: taskProgress.toDouble(),
                      min: 0,
                      max: 100,
                      divisions: 20,
                      onChanged: currentTask == null
                          ? null
                          : (value) {
                              onChanged(plan.updateTaskProgress(plan.focusedTaskIndex, value.round()));
                            },
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                Text(
                  '${taskProgress.round()}%',
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                        color: accent,
                        fontWeight: FontWeight.w800,
                      ),
                ),
              ],
            ),
            const SizedBox(height: 14),
            Text(
              '阶段节点',
              style: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w800),
            ),
            const SizedBox(height: 10),
            SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: Row(
                children: [
                  for (var i = 0; i < plan.tasks.length; i++) ...[
                    _TaskChip(
                      task: plan.tasks[i],
                      progress: plan.progressByTask[i],
                      selected: i == plan.focusedTaskIndex,
                      accent: accent,
                      onTap: () => onChanged(plan.focusTask(i)),
                    ),
                    if (i != plan.tasks.length - 1)
                      Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 6),
                        child: Container(
                          width: 20,
                          height: 2,
                          color: accent.withValues(alpha: 0.28),
                        ),
                      ),
                  ],
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ProgressSection extends StatelessWidget {
  const _ProgressSection({
    required this.label,
    required this.progress,
    required this.accent,
    required this.trailing,
  });

  final String label;
  final double progress;
  final Color accent;
  final String trailing;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Expanded(
              child: Text(
                label,
                style: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w800),
              ),
            ),
            Text(
              trailing,
              style: Theme.of(context).textTheme.titleSmall?.copyWith(
                    color: accent,
                    fontWeight: FontWeight.w800,
                  ),
            ),
          ],
        ),
        const SizedBox(height: 10),
        ClipRRect(
          borderRadius: BorderRadius.circular(999),
          child: LinearProgressIndicator(
            minHeight: 12,
            value: progress,
            color: accent,
            backgroundColor: accent.withValues(alpha: 0.15),
          ),
        ),
      ],
    );
  }
}

class _InfoBadge extends StatelessWidget {
  const _InfoBadge({
    required this.icon,
    required this.label,
  });

  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      decoration: BoxDecoration(
        color: const Color(0xFFF2E7DA),
        borderRadius: BorderRadius.circular(18),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 16, color: const Color(0xFF6E5B4B)),
          const SizedBox(width: 6),
          Text(
            label,
            style: Theme.of(context).textTheme.labelLarge?.copyWith(
                  color: const Color(0xFF5C4A3C),
                ),
          ),
        ],
      ),
    );
  }
}

class _TaskChip extends StatelessWidget {
  const _TaskChip({
    required this.task,
    required this.progress,
    required this.selected,
    required this.accent,
    required this.onTap,
  });

  final ChapterTask task;
  final int progress;
  final bool selected;
  final Color accent;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final background = selected ? accent : Colors.white;
    final foreground = selected ? Colors.white : const Color(0xFF5D4C3E);

    return Material(
      color: Colors.transparent,
      child: InkWell(
        borderRadius: BorderRadius.circular(20),
        onTap: onTap,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 160),
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
          decoration: BoxDecoration(
            color: background,
            borderRadius: BorderRadius.circular(20),
            border: Border.all(color: accent.withValues(alpha: selected ? 0 : 0.22)),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                '第 ${task.startChapter}-${task.endChapter} 章',
                style: Theme.of(context).textTheme.labelLarge?.copyWith(
                      color: foreground,
                      fontWeight: FontWeight.w700,
                    ),
              ),
              const SizedBox(height: 4),
              Text(
                '$progress%',
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: foreground.withValues(alpha: 0.92),
                    ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class CreateBookDialog extends StatefulWidget {
  const CreateBookDialog({super.key});

  @override
  State<CreateBookDialog> createState() => _CreateBookDialogState();
}

class _CreateBookDialogState extends State<CreateBookDialog> {
  final _formKey = GlobalKey<FormState>();
  final _titleController = TextEditingController();
  final _pagesController = TextEditingController();
  final _chaptersController = TextEditingController();
  final _daysController = TextEditingController();
  final _notesController = TextEditingController();
  BookTheme _theme = BookTheme.amber;

  @override
  void dispose() {
    _titleController.dispose();
    _pagesController.dispose();
    _chaptersController.dispose();
    _daysController.dispose();
    _notesController.dispose();
    super.dispose();
  }

  void _submit() {
    if (!_formKey.currentState!.validate()) {
      return;
    }

    final totalPages = int.parse(_pagesController.text.trim());
    final chapterCount = int.parse(_chaptersController.text.trim());
    final plannedDays = int.parse(_daysController.text.trim());
    final tasks = buildTasks(chapterCount: chapterCount, plannedDays: plannedDays);

    final plan = BookPlan(
      id: DateTime.now().microsecondsSinceEpoch.toString(),
      title: _titleController.text.trim(),
      totalPages: totalPages,
      chapterCount: chapterCount,
      plannedDays: plannedDays,
      startDate: DateTime.now(),
      notes: _notesController.text.trim(),
      themeName: _theme.key,
      tasks: tasks,
      progressByTask: List<int>.filled(tasks.length, 0),
      focusedTaskIndex: 0,
    );

    Navigator.of(context).pop(plan);
  }

  @override
  Widget build(BuildContext context) {
    return Dialog(
      insetPadding: const EdgeInsets.symmetric(horizontal: 20, vertical: 24),
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 560),
        child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 18, 20, 20),
          child: SingleChildScrollView(
            child: Form(
              key: _formKey,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          '新建一本书',
                          style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w800),
                        ),
                      ),
                      IconButton(
                        onPressed: () => Navigator.of(context).pop(),
                        icon: const Icon(Icons.close_rounded),
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  Text(
                    '输入最少的信息就够了：书名、总页数、章节数、计划天数。',
                    style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                          color: const Color(0xFF746456),
                        ),
                  ),
                  const SizedBox(height: 18),
                  _FormField(
                    controller: _titleController,
                    label: '书名',
                    validator: (value) => value == null || value.trim().isEmpty ? '请输入书名' : null,
                  ),
                  const SizedBox(height: 14),
                  Row(
                    children: [
                      Expanded(
                        child: _FormField(
                          controller: _pagesController,
                          label: '总页数',
                          keyboardType: TextInputType.number,
                          validator: validatePositiveInt,
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: _FormField(
                          controller: _chaptersController,
                          label: '章节数',
                          keyboardType: TextInputType.number,
                          validator: validatePositiveInt,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 14),
                  _FormField(
                    controller: _daysController,
                    label: '计划天数',
                    keyboardType: TextInputType.number,
                    validator: validatePositiveInt,
                  ),
                  const SizedBox(height: 14),
                  _FormField(
                    controller: _notesController,
                    label: '备注（可选）',
                    maxLines: 3,
                  ),
                  const SizedBox(height: 18),
                  Text(
                    '卡片配色',
                    style: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w800),
                  ),
                  const SizedBox(height: 10),
                  Wrap(
                    spacing: 10,
                    runSpacing: 10,
                    children: BookTheme.values.map((theme) {
                      final selected = _theme == theme;
                      return ChoiceChip(
                        label: Text(theme.label),
                        selected: selected,
                        selectedColor: theme.color.withValues(alpha: 0.18),
                        onSelected: (_) {
                          setState(() {
                            _theme = theme;
                          });
                        },
                        avatar: CircleAvatar(
                          radius: 8,
                          backgroundColor: theme.color,
                        ),
                      );
                    }).toList(),
                  ),
                  const SizedBox(height: 22),
                  Row(
                    children: [
                      Expanded(
                        child: OutlinedButton(
                          onPressed: () => Navigator.of(context).pop(),
                          child: const Text('关闭'),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: FilledButton(
                          onPressed: _submit,
                          child: const Text('生成'),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _FormField extends StatelessWidget {
  const _FormField({
    required this.controller,
    required this.label,
    this.keyboardType,
    this.maxLines = 1,
    this.validator,
  });

  final TextEditingController controller;
  final String label;
  final TextInputType? keyboardType;
  final int maxLines;
  final String? Function(String?)? validator;

  @override
  Widget build(BuildContext context) {
    return TextFormField(
      controller: controller,
      keyboardType: keyboardType,
      maxLines: maxLines,
      validator: validator,
      decoration: InputDecoration(
        labelText: label,
        filled: true,
        fillColor: const Color(0xFFF7F0E6),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(18),
          borderSide: BorderSide.none,
        ),
      ),
    );
  }
}

String? validatePositiveInt(String? value) {
  final parsed = int.tryParse((value ?? '').trim());
  if (parsed == null || parsed <= 0) {
    return '请输入大于 0 的整数';
  }
  return null;
}

List<ChapterTask> buildTasks({
  required int chapterCount,
  required int plannedDays,
}) {
  final taskCount = math.max(1, math.min(chapterCount, math.max(2, (plannedDays / 4).round())));
  final baseSize = chapterCount ~/ taskCount;
  final remainder = chapterCount % taskCount;
  var cursor = 1;
  final tasks = <ChapterTask>[];

  for (var i = 0; i < taskCount; i++) {
    final extra = i < remainder ? 1 : 0;
    final size = baseSize + extra;
    final start = cursor;
    final end = cursor + size - 1;
    tasks.add(ChapterTask(startChapter: start, endChapter: end));
    cursor = end + 1;
  }

  return tasks;
}

class BookPlan {
  const BookPlan({
    required this.id,
    required this.title,
    required this.totalPages,
    required this.chapterCount,
    required this.plannedDays,
    required this.startDate,
    required this.notes,
    required this.themeName,
    required this.tasks,
    required this.progressByTask,
    required this.focusedTaskIndex,
  });

  final String id;
  final String title;
  final int totalPages;
  final int chapterCount;
  final int plannedDays;
  final DateTime startDate;
  final String notes;
  final String themeName;
  final List<ChapterTask> tasks;
  final List<int> progressByTask;
  final int focusedTaskIndex;

  BookTheme get theme => BookTheme.values.firstWhere(
        (item) => item.key == themeName,
        orElse: () => BookTheme.amber,
      );

  int get elapsedDays => DateTime.now().difference(DateTime(startDate.year, startDate.month, startDate.day)).inDays + 1;

  bool get isComplete => progressByTask.every((value) => value >= 100);

  int get completedTaskCount => progressByTask.where((value) => value >= 100).length;

  ChapterTask? get focusedTask => tasks.isEmpty ? null : tasks[focusedTaskIndex.clamp(0, tasks.length - 1)];

  double get completedChapters {
    var total = 0.0;
    for (var i = 0; i < tasks.length; i++) {
      total += tasks[i].span * (progressByTask[i] / 100);
    }
    return total;
  }

  double get bookProgressPercent {
    if (chapterCount == 0) {
      return 0;
    }
    return (completedChapters / chapterCount * 100).clamp(0, 100).toDouble();
  }

  BookPlan updateTaskProgress(int index, int progress) {
    final nextProgress = [...progressByTask];
    nextProgress[index] = progress.clamp(0, 100);
    return copyWith(progressByTask: nextProgress);
  }

  BookPlan focusTask(int index) {
    return copyWith(focusedTaskIndex: index.clamp(0, tasks.length - 1));
  }

  BookPlan copyWith({
    String? id,
    String? title,
    int? totalPages,
    int? chapterCount,
    int? plannedDays,
    DateTime? startDate,
    String? notes,
    String? themeName,
    List<ChapterTask>? tasks,
    List<int>? progressByTask,
    int? focusedTaskIndex,
  }) {
    return BookPlan(
      id: id ?? this.id,
      title: title ?? this.title,
      totalPages: totalPages ?? this.totalPages,
      chapterCount: chapterCount ?? this.chapterCount,
      plannedDays: plannedDays ?? this.plannedDays,
      startDate: startDate ?? this.startDate,
      notes: notes ?? this.notes,
      themeName: themeName ?? this.themeName,
      tasks: tasks ?? this.tasks,
      progressByTask: progressByTask ?? this.progressByTask,
      focusedTaskIndex: focusedTaskIndex ?? this.focusedTaskIndex,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'title': title,
      'totalPages': totalPages,
      'chapterCount': chapterCount,
      'plannedDays': plannedDays,
      'startDate': startDate.toIso8601String(),
      'notes': notes,
      'themeName': themeName,
      'tasks': tasks.map((task) => task.toJson()).toList(),
      'progressByTask': progressByTask,
      'focusedTaskIndex': focusedTaskIndex,
    };
  }

  factory BookPlan.fromJson(Map<String, dynamic> json) {
    final tasks = (json['tasks'] as List<dynamic>)
        .map((item) => ChapterTask.fromJson(item as Map<String, dynamic>))
        .toList();
    final progressByTask = (json['progressByTask'] as List<dynamic>).map((item) => (item as num).toInt()).toList();

    return BookPlan(
      id: json['id'] as String,
      title: json['title'] as String,
      totalPages: json['totalPages'] as int,
      chapterCount: json['chapterCount'] as int,
      plannedDays: json['plannedDays'] as int,
      startDate: DateTime.parse(json['startDate'] as String),
      notes: json['notes'] as String,
      themeName: json['themeName'] as String,
      tasks: tasks,
      progressByTask: progressByTask,
      focusedTaskIndex: (json['focusedTaskIndex'] as int).clamp(0, math.max(0, tasks.length - 1)),
    );
  }
}

class ChapterTask {
  const ChapterTask({
    required this.startChapter,
    required this.endChapter,
  });

  final int startChapter;
  final int endChapter;

  int get span => endChapter - startChapter + 1;

  Map<String, dynamic> toJson() {
    return {
      'startChapter': startChapter,
      'endChapter': endChapter,
    };
  }

  factory ChapterTask.fromJson(Map<String, dynamic> json) {
    return ChapterTask(
      startChapter: json['startChapter'] as int,
      endChapter: json['endChapter'] as int,
    );
  }
}

enum BookTheme {
  amber('amber', '琥珀黄', Color(0xFFC86B35)),
  teal('teal', '海盐绿', Color(0xFF1F8D7A)),
  coral('coral', '珊瑚橘', Color(0xFFD05C3C)),
  ink('ink', '深墨蓝', Color(0xFF3F5F90));

  const BookTheme(this.key, this.label, this.color);

  final String key;
  final String label;
  final Color color;
}

String formatDate(DateTime date) {
  final month = date.month.toString().padLeft(2, '0');
  final day = date.day.toString().padLeft(2, '0');
  return '${date.year}-$month-$day';
}
