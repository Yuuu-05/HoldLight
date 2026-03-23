import { useMemo } from 'react';
import { useLanguage } from '../../../app/providers/LanguageProvider';
import { usePageTitle } from '../../../shared/hooks/usePageTitle';
import TutorialPageLayout, { type TutorialStoryCard } from '../components/TutorialPageLayout';

export default function TermsPage() {
  const { language, t } = useLanguage();
  usePageTitle(t('Climbing terms'));

  const cards = useMemo<TutorialStoryCard[]>(
    () =>
      language === 'zh'
        ? [
            {
              id: 'hold',
              eyebrow: '术语篇 01',
              title: 'Hold，就是你要抓或踩的点。',
              description: '它可能给手用，也可能给脚用。先记住“点位”这个概念，就已经很够用了。',
              art: 'terms',
              artLabel: 'Hold',
              srText:
                '术语图解。几个圆润的点位像卡片一样浮在墙前。请向用户朗读：Hold 指墙上的抓点或踩点。它可以帮助双手发力，也可以让双脚保持稳定。先理解它是接触点，就能更容易听懂指导。',
            },
            {
              id: 'route',
              eyebrow: '术语篇 02',
              title: 'Route，就是你要跟随的那条路径。',
              description: '墙上可能有很多颜色。只跟你当前选择的那一条，不要随手混抓。',
              art: 'route',
              artLabel: 'Route',
              srText:
                '术语图解。一条路线被清楚地标出。请向用户朗读：Route 是线路，是同一组点位组成的攀爬路径。即使墙上颜色很多，也要跟住你当前这条路线，减少混乱和误判。',
            },
            {
              id: 'grade',
              eyebrow: '术语篇 03',
              title: 'Grade，表示这条线路大概有多难。',
              description: '数字越友好，越适合把动作练顺。先从低难度开始，最容易建立信心。',
              art: 'grade',
              artLabel: 'Grade',
              srText:
                '术语图解。难度像温和上升的刻度条。请向用户朗读：Grade 是线路难度等级。新手应优先选择较低难度，让身体先学会节奏、脚步和控制，再逐渐挑战更高等级。',
            },
            {
              id: 'belay',
              eyebrow: '术语篇 04',
              title: 'Belay，指绳索保护支持。',
              description: '只要一条路线涉及 belay，就必须由受过训练的人来操作，不能自己猜。',
              art: 'support',
              artLabel: 'Belay',
              srText:
                '术语图解。对话气泡和保护提示并排出现。请向用户朗读：Belay 指绳索攀登中的保护操作，用来管理绳子并保护攀爬者。凡是需要 belay 的路线，都应由工作人员或受过训练的伙伴负责。',
            },
          ]
        : [
            {
              id: 'hold',
              eyebrow: 'Terms 01',
              title: 'Hold means the part you touch.',
              description: 'It can be for hands or feet. Start by remembering that a hold is simply your contact point.',
              art: 'terms',
              artLabel: 'Hold',
              srText:
                'Terms illustration. Rounded climbing points float like flash cards. Read to the user: a hold is the part of the wall you grip with your hand or step on with your foot. Understanding this one word makes later instructions easier to follow.',
            },
            {
              id: 'route',
              eyebrow: 'Terms 02',
              title: 'Route means the path you follow.',
              description: 'A wall can show many colors at once. Stay with the line that belongs to your chosen climb.',
              art: 'route',
              artLabel: 'Route',
              srText:
                'Terms illustration. One route is highlighted on a gentle wall panel. Read to the user: a route is the sequence of holds used for one climb. Follow your route only, even when other colors nearby look tempting.',
            },
            {
              id: 'grade',
              eyebrow: 'Terms 03',
              title: 'Grade tells you how hard the route feels.',
              description: 'Kinder numbers are better for early practice. Lower grades help your body learn calm movement first.',
              art: 'grade',
              artLabel: 'Grade',
              srText:
                'Terms illustration. Difficulty rises like a soft ladder. Read to the user: grade means route difficulty. Beginners should choose lower grades first so technique and confidence can grow before harder climbs.',
            },
            {
              id: 'belay',
              eyebrow: 'Terms 04',
              title: 'Belay means rope safety support.',
              description: 'If a route uses belay, only trained staff or partners should manage the rope system.',
              art: 'support',
              artLabel: 'Belay',
              srText:
                'Terms illustration. A support bubble appears beside a safety cue. Read to the user: belay is the rope safety system used on rope climbs. Any route that requires belay should be handled by trained people, never by guesswork.',
            },
          ],
    [language],
  );

  return <TutorialPageLayout currentId="terms" cards={cards} />;
}
