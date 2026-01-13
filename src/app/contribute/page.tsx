import { SiteHeader } from '../components/SiteHeader';
import { PageShell } from '../components/PageShell';
import { buttonStyles, cardStyles } from '../components/ui/styles';
import { TipForm } from './components/TipForm';

const SURVEY_URL = 'https://v.wjx.cn/vm/twyt7dF.aspx#';

export default function ContributePage() {
  return (
    <PageShell
      variant="gradient"
      header={<SiteHeader />}
      footerVariant="rights"
      footerText="? 2025 Phigros Query. All Rights Reserved."
      mainClassName="relative z-10 flex-1 p-4 sm:p-6 lg:p-8"
      containerClassName="max-w-2xl mx-auto space-y-8"
    >
      {/* Title */}
      <div className="text-center">
        <h1 className="text-3xl sm:text-4xl font-bold mb-4 text-gray-900 dark:text-gray-100">投稿与反馈</h1>
        <p className="text-base text-gray-600 dark:text-gray-400">分享你的创意，或帮助我们改进</p>
      </div>

      {/* Tip Submission Card（交互由客户端组件处理） */}
      <TipForm />

      {/* Survey Card */}
      <div
        className={cardStyles({
          tone: 'glass',
          dashed: true,
          className: 'bg-white/50 dark:bg-neutral-900/40 border-gray-200/30 dark:border-neutral-800/30 backdrop-blur-sm',
        })}
      >
        <div className="flex items-center gap-3 mb-4 opacity-75">
          <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg text-purple-600 dark:text-purple-400">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">问卷调查</h2>
        </div>
        <p className="text-gray-600 dark:text-gray-400 text-sm mb-4">
          我们正在进行一次用户调研（约 10–15 分钟），用于优化功能优先级与体验细节。问卷不需要任何登录凭证信息，请勿填写 SessionToken/API Token 等敏感内容。
        </p>
        <a href={SURVEY_URL} target="_blank" rel="noopener noreferrer" className={buttonStyles({ size: 'sm', variant: 'primary' })}>
          立即填写
        </a>
      </div>
    </PageShell>
  );
}

