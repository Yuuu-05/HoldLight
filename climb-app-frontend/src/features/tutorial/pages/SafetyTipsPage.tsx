import { useMemo } from 'react';
import { useLanguage } from '../../../app/providers/LanguageProvider';
import { usePageTitle } from '../../../shared/hooks/usePageTitle';
import TutorialPageLayout, { type TutorialStoryCard } from '../components/TutorialPageLayout';

export default function SafetyTipsPage() {
  const { language, t } = useLanguage();
  usePageTitle(t('Safety tips'));

  const cards = useMemo<TutorialStoryCard[]>(
    () =>
      language === 'zh'
        ? [
            {
              id: 'warmup',
              eyebrow: '安全篇 01',
              title: '先热身，再上墙。',
              description: '把手指、肩膀、髋部和小腿唤醒。身体越从容，动作越不会慌乱。',
              art: 'warmup',
              artLabel: '热身',
              srText:
                '安全图解。一个热身动作在柔和背景中展开。请向用户朗读：攀爬前先活动手指、肩膀、腿部和核心，帮助身体进入状态。冷着身体直接上墙，会让动作变得生硬，也更容易紧张。',
            },
            {
              id: 'check-area',
              eyebrow: '安全篇 02',
              title: '起步前，先看地面和周围。',
              description: '确认垫子、绳索和他人位置都清楚，再离开地面。抬头之前，先低头检查。',
              art: 'check',
              artLabel: '环境检查',
              srText:
                '安全图解。一张清单提醒用户检查场地。请向用户朗读：开始攀爬前，先确认地垫平整、区域无遮挡、没有人正在你下方停留。如果是绳索区，也要确认装备和路线已被正确准备。',
            },
            {
              id: 'three-points',
              eyebrow: '安全篇 03',
              title: '能保持三点支撑时，就不要急。',
              description: '两脚一手，或两手一脚。稳定移动会比突然猛拉更安全，也更省力。',
              art: 'balance',
              artLabel: '三点支撑',
              srText:
                '安全图解。攀爬姿势展示三点支撑。请向用户朗读：在可能的情况下，尽量让身体保持三点接触墙面。这样可以给下一步留出时间，也能减少失去平衡的风险。',
            },
            {
              id: 'stop',
              eyebrow: '安全篇 04',
              title: '疼痛、发晕或害怕到失控时，马上停。',
              description: '今天不必硬撑着完成。安全下墙、寻求帮助，再决定下一步，比逞强更专业。',
              art: 'shield',
              artLabel: '立即停止',
              srText:
                '安全图解。一个保护盾牌提醒用户停下。请向用户朗读：如果你出现疼痛、头晕、强烈恐惧，或感觉动作已经失去控制，应立刻停止攀爬。安全永远比登顶更重要。',
            },
          ]
        : [
            {
              id: 'warmup',
              eyebrow: 'Safety 01',
              title: 'Warm up before you leave the ground.',
              description: 'Wake up your fingers, shoulders, hips, and calves. A calm body moves with less panic.',
              art: 'warmup',
              artLabel: 'Warm-up',
              srText:
                'Safety illustration. A warm-up movement opens in a soft background. Read to the user: before climbing, prepare the fingers, shoulders, legs, and core so the body feels ready. Starting cold makes movement stiff and raises tension.',
            },
            {
              id: 'check-area',
              eyebrow: 'Safety 02',
              title: 'Check the floor and the zone before you climb.',
              description: 'Look down first. Make sure mats, ropes, and nearby people are clear before you look up.',
              art: 'check',
              artLabel: 'Area check',
              srText:
                'Safety illustration. A checklist floats beside the climbing area. Read to the user: before starting, confirm the mats are clear, the landing area is open, and no one is standing beneath you. In rope areas, make sure the setup has been checked too.',
            },
            {
              id: 'three-points',
              eyebrow: 'Safety 03',
              title: 'Keep three steady points whenever you can.',
              description: 'Two feet and one hand, or two hands and one foot. Slow movement is safer than sudden pulling.',
              art: 'balance',
              artLabel: 'Three points',
              srText:
                'Safety illustration. A climbing pose shows three stable contact points. Read to the user: whenever possible, keep three points touching the wall while you move the fourth. This gives you more control and reduces the chance of losing balance.',
            },
            {
              id: 'stop',
              eyebrow: 'Safety 04',
              title: 'Pain, dizziness, or panic means stop.',
              description: 'You do not need to force today’s route. Climb down safely, ask for help, and reset.',
              art: 'shield',
              artLabel: 'Stop early',
              srText:
                'Safety illustration. A protective shield signals an immediate pause. Read to the user: if you feel pain, dizziness, or fear that is turning into loss of control, stop climbing right away. Safety always matters more than finishing the route.',
            },
          ],
    [language],
  );

  return <TutorialPageLayout currentId="safety" cards={cards} />;
}
