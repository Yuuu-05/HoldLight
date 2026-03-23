import { useMemo } from 'react';
import { useLanguage } from '../../../app/providers/LanguageProvider';
import { usePageTitle } from '../../../shared/hooks/usePageTitle';
import TutorialPageLayout, { type TutorialStoryCard } from '../components/TutorialPageLayout';

export default function RulesPage() {
  const { language, t } = useLanguage();
  usePageTitle(t('Climbing rules'));

  const cards = useMemo<TutorialStoryCard[]>(
    () =>
      language === 'zh'
        ? [
            {
              id: 'route-story',
              eyebrow: '规则篇 01',
              title: '一条线路，是一段被设计好的路径。',
              description: '起点、终点和颜色标记，会告诉你这条路线从哪里开始、到哪里结束。',
              art: 'route',
              artLabel: '识别线路',
              srText:
                '规则图解。一面练习墙上有一条清晰向上的路线。请向用户朗读：线路不是随意乱抓，而是一组按照规则设计好的起点和终点。先认出起始点和结束点，攀爬会更有方向感。',
            },
            {
              id: 'easy-first',
              eyebrow: '规则篇 02',
              title: '先爬简单线，动作会学得更稳。',
              description: '新手最需要的不是高度，而是把脚放准、把身体放稳、把节奏放慢。',
              art: 'grade',
              artLabel: '从易开始',
              srText:
                '规则图解。难度像阶梯一样从低到高排列。请向用户朗读：初学者应先从低难度开始，让身体熟悉墙面和节奏。容易的线路不是退步，而是建立好习惯的最快方法。',
            },
            {
              id: 'feet-first',
              eyebrow: '规则篇 03',
              title: '脚步比你想象中更重要。',
              description: '把重心送近墙面，先稳住脚，再移动手。手臂不必一直硬拉。',
              art: 'balance',
              artLabel: '脚步与重心',
              srText:
                '规则图解。一个攀爬姿势展示三点支撑和平衡移动。请向用户朗读：新手常常只想用手往上拉，但真正稳定的攀爬依赖脚步和重心。先踩稳、再转移，动作会更轻松。',
            },
            {
              id: 'ask-early',
              eyebrow: '规则篇 04',
              title: '看不懂时，停下来问。',
              description: '工作人员和指导者更愿意你早点发问，而不是在紧张时硬撑着往上。',
              art: 'support',
              artLabel: '及时求助',
              srText:
                '规则图解。一个对话气泡停在路线旁边。请向用户朗读：如果你不确定该抓哪一组点、该从哪里起步，最安全的做法就是暂停并提问。清楚规则，比逞强继续更重要。',
            },
          ]
        : [
            {
              id: 'route-story',
              eyebrow: 'Rules 01',
              title: 'A route is a designed path, not a random grab.',
              description: 'Start holds, finish holds, and color markings show where the climb begins and where it ends.',
              art: 'route',
              artLabel: 'Read the route',
              srText:
                'Rules illustration. A climbing wall shows one clear route moving upward. Read to the user: a route is a planned path with a defined start and finish. Identify those points first so the climb makes sense before you leave the ground.',
            },
            {
              id: 'easy-first',
              eyebrow: 'Rules 02',
              title: 'Easy routes teach stronger habits.',
              description: 'Your first goal is not height. It is steady feet, calm movement, and slower decisions.',
              art: 'grade',
              artLabel: 'Start easier',
              srText:
                'Rules illustration. Difficulty steps rise from gentle to hard. Read to the user: beginners should begin on lower grades so the wall feels understandable. Easier routes are where balance and confidence get built.',
            },
            {
              id: 'feet-first',
              eyebrow: 'Rules 03',
              title: 'Your feet matter more than you think.',
              description: 'Bring your hips close to the wall, trust the footholds, and let your arms relax between moves.',
              art: 'balance',
              artLabel: 'Footwork first',
              srText:
                'Rules illustration. A climber moves with three clear contact points. Read to the user: stable climbing comes from careful feet and balanced body position. Beginners should step first, then move the hands instead of pulling all the time.',
            },
            {
              id: 'ask-early',
              eyebrow: 'Rules 04',
              title: 'Pause and ask as soon as you feel unsure.',
              description: 'Staff and guides would rather answer early than watch you force a confusing move.',
              art: 'support',
              artLabel: 'Ask early',
              srText:
                'Rules illustration. A dialogue bubble appears beside the wall. Read to the user: if you cannot identify the route or the starting holds, stop and ask. Clarifying the rule early is safer than guessing while already stressed.',
            },
          ],
    [language],
  );

  return <TutorialPageLayout currentId="rules" cards={cards} />;
}
