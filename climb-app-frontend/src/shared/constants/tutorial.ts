export interface TutorialModule {
  id: string;
  title: string;
  description: string;
  route: string;
  points: string[];
  readAloudText: string;
  estimatedMinutes: number;
}

export const tutorialModules: TutorialModule[] = [
  {
    id: 'safety',
    title: 'Safety tips',
    description:
      'Review warm-up, equipment checking, safe climbing behaviour, and when to stop and ask for help.',
    route: '/tutorial/safety',
    points: [
      'Warm up before climbing',
      'Check gear carefully',
      'Stop and ask for help when needed',
    ],
    readAloudText:
      'Safety tips. Review warm-up, equipment checking, safe climbing behaviour, and when to stop and ask for help.',
    estimatedMinutes: 3,
  },
  {
    id: 'rules',
    title: 'Climbing rules',
    description:
      'Learn how climbing routes work, where to start, how to identify the finish, and how beginners should begin safely.',
    route: '/tutorial/rules',
    points: [
      'Understand start and finish holds',
      'Recognise a climbing route',
      'Begin from easier levels',
    ],
    readAloudText:
      'Climbing rules. Learn how climbing routes work, where to start, how to identify the finish, and how beginners should begin safely.',
    estimatedMinutes: 3,
  },
  {
    id: 'equipment',
    title: 'Equipment guide',
    description:
      'Get familiar with climbing shoes, chalk, harnesses, and simple equipment preparation tips for beginners.',
    route: '/tutorial/equipment',
    points: [
      'Know basic beginner gear',
      'Understand the purpose of climbing shoes',
      'Learn simple preparation tips',
    ],
    readAloudText:
      'Equipment guide. Learn about climbing shoes, chalk, harnesses, and simple beginner preparation tips.',
    estimatedMinutes: 4,
  },
  {
    id: 'terms',
    title: 'Climbing terms',
    description:
      'Understand important climbing words such as hold, route, grade, start hold, finish hold, and belay.',
    route: '/tutorial/terms',
    points: [
      'Learn key climbing vocabulary',
      'Understand route difficulty',
      'Recognise basic wall instructions',
    ],
    readAloudText:
      'Climbing terms. Understand important words such as hold, route, grade, start hold, finish hold, and belay.',
    estimatedMinutes: 3,
  },
];

export const tutorialModuleMap = Object.fromEntries(
  tutorialModules.map((module) => [module.id, module]),
) as Record<string, TutorialModule>;

export function getTutorialModule(id: string) {
  return tutorialModuleMap[id];
}

export function getTutorialIndex(id: string) {
  return tutorialModules.findIndex((module) => module.id === id);
}

export function getTutorialNeighbors(id: string) {
  const currentIndex = getTutorialIndex(id);
  if (currentIndex === -1) {
    return {
      previous: null,
      next: null,
      currentIndex: -1,
      total: tutorialModules.length,
    };
  }

  return {
    previous: currentIndex > 0 ? tutorialModules[currentIndex - 1] : null,
    next: currentIndex < tutorialModules.length - 1 ? tutorialModules[currentIndex + 1] : null,
    currentIndex,
    total: tutorialModules.length,
  };
}

export function getNextTutorialModule(completedIds: string[]) {
  return tutorialModules.find((module) => !completedIds.includes(module.id)) ?? tutorialModules[0];
}
