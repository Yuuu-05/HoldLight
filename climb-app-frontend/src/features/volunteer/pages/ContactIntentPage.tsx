import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../../app/providers/AuthProvider';
import { useLanguage } from '../../../app/providers/LanguageProvider';
import { getVolunteerContactIntentsApi } from '../../../shared/api/volunteers.api';
import GuideMascot from '../../../shared/components/illustration/GuideMascot';
import { routes } from '../../../shared/constants/routes';
import type { VolunteerApplication, VolunteerPostItem } from '../../../shared/types/volunteer';
import { formatDate } from '../../../shared/utils/formatDate';
import SocialEmptyState from '../../social/components/SocialEmptyState';

export default function ContactIntentPage() {
  const { user } = useAuth();
  const { language, t } = useLanguage();
  const isZh = language === 'zh';
  const [myRequests, setMyRequests] = useState<VolunteerPostItem[]>([]);
  const [myApplications, setMyApplications] = useState<
    Array<{ item: VolunteerPostItem; application: VolunteerApplication }>
  >([]);

  useEffect(() => {
    getVolunteerContactIntentsApi(user).then((result) => {
      setMyRequests(result.myRequests);
      setMyApplications(result.myApplications);
    });
  }, [user]);

  return (
    <section className="social-shell stack-lg">
      <div className="social-detail-hero social-detail-hero-intent">
        <div className="stack-md">
          <div className="stack-sm">
            <p className="social-eyebrow">{isZh ? '轻压力便签' : 'Low-pressure notes'}</p>
            <h1>{t('Contact intents')}</h1>
            <p>
              {isZh
                ? '结构化留言让志愿者协调保持轻松。这里没有即时聊天压力，只有关于意向、时间和下一步的清晰信号。'
                : 'Structured notes keep volunteer coordination gentle. No fast chat pressure, just clear signals about interest, timing, and next steps.'}
            </p>
          </div>
          <div className="inline-actions wrap">
            <Link className="social-inline-link" to={routes.socialFeed}>{isZh ? '返回社区' : t('Back to community')}</Link>
            <Link className="social-inline-link" to={routes.volunteerBoard}>{isZh ? '返回志愿者公告板' : 'Back to volunteer board'}</Link>
            <Link className="social-inline-link" to={routes.volunteerCreate}>{t('Create request')}</Link>
          </div>
        </div>
        <div className="social-featured-illustration">
          <span className="social-featured-note">Monkey treats every note like a postcard.</span>
          <GuideMascot className="social-featured-mascot" pose="tilt" />
        </div>
      </div>

      <div className="grid-2 social-note-columns">
        <section className="stack-md">
          <div className="stack-sm">
            <h2>{isZh ? '我发布的请求' : 'Requests I created'}</h2>
            <p className="subtle-text">
              {isZh
                ? '你发布的支持请求，以及悄悄靠近的人，都在这里。'
                : 'Support requests you published, together with the people quietly reaching out.'}
            </p>
          </div>

          {myRequests.length ? (
            <div className="social-note-board">
              {myRequests.map((item) => (
                <article key={item.id} className="intent-note intent-note-request">
                  <span className="intent-note-pin" aria-hidden="true" />
                  <p className="social-eyebrow">Created by you</p>
                  <h3>{item.title}</h3>
                  <p>{item.location} • {formatDate(item.sessionTime)}</p>
                  <p>{t('Interested volunteers')}: {item.applicants.length}</p>
                  <Link className="social-inline-link" to={routes.volunteerPostDetail(item.id)}>
                    {t('View request details')}
                  </Link>
                </article>
              ))}
            </div>
          ) : (
            <SocialEmptyState
              title={t('No created requests yet')}
              body={
                isZh
                  ? '你发布的志愿者请求会和收到的联系留言一起出现在这里。'
                  : 'Volunteer requests you create will appear here together with incoming contact intents.'
              }
              action={<Link className="social-featured-link" to={routes.volunteerCreate}>{isZh ? '发起求助' : t('Create request')}</Link>}
              pose="nod"
            />
          )}
        </section>

        <section className="stack-md">
          <div className="stack-sm">
            <h2>{isZh ? '我表达过兴趣的请求' : 'Requests I expressed interest in'}</h2>
            <p className="subtle-text">
              {isZh
                ? '每张留言都保持结构化和安静，所以下一步不会像吵闹的聊天线程。'
                : 'Each note stays structured and calm, so the next step never feels like a noisy chat thread.'}
            </p>
          </div>

          {myApplications.length ? (
            <div className="social-note-board">
              {myApplications.map(({ item, application }) => (
                <article key={application.id} className={`intent-note intent-note-${application.status}`.trim()}>
                  <span className="intent-note-pin" aria-hidden="true" />
                  <p className="social-eyebrow">{application.status}</p>
                  <h3>{item.title}</h3>
                  <p>{item.location} • {formatDate(item.sessionTime)}</p>
                  <p><strong>{t('Your message:')}</strong> {application.message}</p>
                  <p className="subtle-text">
                    {t('Sent on')} {formatDate(application.createdAt)}. {t('Status:')} {t(application.status)}.
                  </p>
                  <Link className="social-inline-link" to={routes.volunteerPostDetail(item.id)}>
                    {t('Open request')}
                  </Link>
                </article>
              ))}
            </div>
          ) : (
            <SocialEmptyState
              title={t('No contact intents yet')}
              body={
                isZh
                  ? '当你在志愿者请求上点击“表达兴趣”时，留言会出现在这里。'
                  : "When you click 'Express interest' on a volunteer request, the message will appear here."
              }
              action={<Link className="social-featured-link" to={routes.volunteerBoard}>{isZh ? '返回志愿者公告板' : 'Back to volunteer board'}</Link>}
              pose="tilt"
            />
          )}
        </section>
      </div>
    </section>
  );
}
