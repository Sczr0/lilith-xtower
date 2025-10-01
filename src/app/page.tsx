import Image from 'next/image';

// 强制页面为动态渲染，确保每次访问都重新执行随机逻辑
export const dynamic = 'force-dynamic';

// 定义角色信息，每个角色拥有一个图片池 (imagePool)
const characters = [
  {
    name: '可爱的莉莉丝',
    imagePool: [
      '/a1.png',
      '/a2.jpg',
      '/a3.jpg',
    ],
  },
  {
    name: '亲爱的长夜月',
    imagePool: [
      '/b1.png',
      '/b2.png',
    ],
  },
];

export default function Home() {
  // 第一步：随机选择一个角色
  const randomCharacterIndex = Math.floor(Math.random() * characters.length);
  const selectedCharacter = characters[randomCharacterIndex];

  // 第二步：从选定角色的图片池中，随机选择一张图片
  const randomImageIndex = Math.floor(Math.random() * selectedCharacter.imagePool.length);
  const selectedImage = selectedCharacter.imagePool[randomImageIndex];

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24 bg-gray-50">
      <div className="text-center p-8 bg-white rounded-xl shadow-lg">
        <h1 className="text-4xl font-bold mb-4">🚧 施工中 🚧</h1>
        <p className="text-xl text-gray-700">
          你来的真早~但还没开门，看看{selectedCharacter.name}吧~
        </p>
        <div className="mt-8">
          <Image
            src={selectedImage}
            alt={`一张${selectedCharacter.name}的图片`}
            width={400}
            height={400}
            className="rounded-lg object-cover"
            priority
          />
        </div>
      </div>
    </main>
  );
}
