import { useMemo } from 'react';
import { useLanguage } from '../../../app/providers/LanguageProvider';
import { usePageTitle } from '../../../shared/hooks/usePageTitle';
import TutorialPageLayout, { type TutorialStoryCard } from '../components/TutorialPageLayout';

export default function EquipmentPage() {
  const { language, t } = useLanguage();
  usePageTitle(t('Equipment guide'));

  const cards = useMemo<TutorialStoryCard[]>(
    () =>
      language === 'zh'
        ? [
            {
              id: 'lifeline',
              eyebrow: '装备篇 01',
              title: '安全带是你的生命线。',
              description: '腰带应稳稳卡在胯骨上方。松垮的安全带不会给你真正的安全感。',
              art: 'harness',
              artLabel: '安全带贴合',
              srText:
                '装备图解。一条柔软的安全带悬在卡片中央。请向用户朗读：正确穿戴安全带时，腰环应位于胯骨上方，两侧腿环贴合但不勒痛，任何不确定都应立即请工作人员检查。',
            },
            {
              id: 'shoes',
              eyebrow: '装备篇 02',
              title: '攀岩鞋要贴脚，不要折磨脚。',
              description: '轻微包裹感会带来控制力。明显刺痛、麻木或站不稳，说明尺码不合适。',
              art: 'shoes',
              artLabel: '鞋子贴合',
              srText:
                '装备图解。一双圆润的攀岩鞋并排摆放。请向用户朗读：新手攀岩鞋需要稳定包裹脚掌，帮助踩住小点，但不应该让脚趾持续疼痛。舒服而稳，比一味买小更重要。',
            },
            {
              id: 'chalk',
              eyebrow: '装备篇 03',
              title: '镁粉只是助手，不是魔法。',
              description: '手汗多时用一点点就够了。真正决定稳定度的，还是脚步、重心和节奏。',
              art: 'chalk',
              artLabel: '镁粉袋',
              srText:
                '装备图解。一个镁粉袋悬在轻柔背景里。请向用户朗读：镁粉能帮助双手保持干爽，但它不能替代基础动作。用量适中，注意呼吸、脚步和身体平衡，才是初学者更关键的技巧。',
            },
            {
              id: 'rent',
              eyebrow: '装备篇 04',
              title: '第一天先租，再决定买什么。',
              description: '刚开始时，安全贴合、舒适活动和现场指导，远比一次买齐全部装备更重要。',
              art: 'gear',
              artLabel: '先租后买',
              srText:
                '装备图解。一组租赁装备整齐挂起。请向用户朗读：新手第一次攀岩时，可以优先租鞋、租安全带，先建立对装备的感受，再决定是否购买。把预算留给合适的贴合度和后续练习，比冲动消费更稳妥。',
            },
          ]
        : [
            {
              id: 'lifeline',
              eyebrow: 'Equipment 01',
              title: 'Your harness is your lifeline.',
              description: 'The waist belt should sit above the hip bones. Loose gear never feels secure for long.',
              art: 'harness',
              artLabel: 'Harness fit',
              srText:
                'Equipment illustration. A soft harness sits in the center of the card. Read to the user: a correctly worn harness keeps the waist belt above the hip bones and the leg loops snug but comfortable. Ask staff to check the fit whenever you are unsure.',
            },
            {
              id: 'shoes',
              eyebrow: 'Equipment 02',
              title: 'Shoes should hug, not hurt.',
              description: 'A close fit improves control. Sharp pain, numbness, or unstable footing means the size is wrong.',
              art: 'shoes',
              artLabel: 'Shoe fit',
              srText:
                'Equipment illustration. Two beginner climbing shoes rest side by side. Read to the user: climbing shoes should hold the foot firmly enough for control on small holds, but they should not cause ongoing pain. Stable and comfortable is better than forcing a tiny size.',
            },
            {
              id: 'chalk',
              eyebrow: 'Equipment 03',
              title: 'Chalk is a helper, not magic.',
              description: 'Use a little when sweat builds up. Your feet, balance, and timing still matter more than white hands.',
              art: 'chalk',
              artLabel: 'Chalk bag',
              srText:
                'Equipment illustration. A chalk bag hangs in a soft cloud of powder. Read to the user: chalk helps dry sweaty hands, but it does not replace technique. For beginners, calm breathing, careful foot placement, and body balance make the bigger difference.',
            },
            {
              id: 'rent',
              eyebrow: 'Equipment 04',
              title: 'Rent first. Buy later.',
              description: 'At the start, safe fit, easy movement, and staff guidance matter more than owning a full kit.',
              art: 'gear',
              artLabel: 'Rental first',
              srText:
                'Equipment illustration. A neat rental rack holds simple beginner gear. Read to the user: for an early climbing session, renting shoes and a harness is enough. Learn how equipment should feel on your body before you spend money on your own set.',
            },
          ],
    [language],
  );

  return <TutorialPageLayout currentId="equipment" cards={cards} />;
}
