import { QueryInput } from "./components/QueryInput";
import { ThemeToggle } from "./components/ThemeToggle";

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen bg-gray-50 text-gray-900 dark:bg-gray-900 dark:text-gray-50">
      {/* Header */}
      <header className="px-4 lg:px-6 h-14 flex items-center shadow-sm">
        <a className="flex items-center justify-center" href="#">
          <span className="text-lg font-semibold">Phigros 查询</span>
        </a>
        <nav className="ml-auto flex gap-4 sm:gap-6">
          <ThemeToggle />
        </nav>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center">
        <div className="text-center space-y-4">
          <h1 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl">
            Phigros 成绩查询与图片生成器
          </h1>
          <p className="text-gray-500 md:text-xl dark:text-gray-400">
            输入您的玩家 ID，开始生成专属成绩图片。
          </p>
          <div className="flex justify-center">
            <QueryInput />
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="flex items-center justify-center h-16 border-t">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          © 2024 Phigros Query. All Rights Reserved.
        </p>
      </footer>
    </div>
  );
}
