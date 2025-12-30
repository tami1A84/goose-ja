import { useState } from 'react';
import { useTextAnimator } from '../../hooks/use-text-animator';

interface GreetingProps {
  className?: string;
  forceRefresh?: boolean;
}

export function Greeting({
  className = 'mt-1 text-4xl font-light animate-in fade-in duration-300',
  forceRefresh = false,
}: GreetingProps) {
  const prefixes = ['こんにちは！'];
  const messages = [
    ' 始める準備はできましたか？',
    ' 何に取り組みますか？',
    ' 素晴らしいものを作る準備はできましたか？',
    ' 何を探求しますか？',
    ' 何か考えていることはありますか？',
    ' 今日は何を作りましょうか？',
    ' どのプロジェクトに取り組みますか？',
    ' 何に挑戦しますか？',
    ' 何を調べたいですか？',
    ' 何をする必要がありますか？',
    ' 今日の計画は何ですか？',
    ' 素晴らしいものを作る準備はできましたか？',
    ' 今日は何を構築できますか？',
    ' 次の課題は何ですか？',
    ' どんな進歩ができますか？',
    ' 何を達成したいですか？',
    ' どんなタスクが待っていますか？',
    ' 今日のミッションは何ですか？',
    ' 何を達成できますか？',
    ' どのプロジェクトを始める準備ができていますか？',
  ];

  // Using lazy initializer to generate random greeting on each component instance
  const greeting = useState(() => {
    const randomPrefixIndex = Math.floor(Math.random() * prefixes.length);
    const randomMessageIndex = Math.floor(Math.random() * messages.length);

    return {
      prefix: prefixes[randomPrefixIndex],
      message: messages[randomMessageIndex],
    };
  })[0];

  const messageRef = useTextAnimator({ text: greeting.message });

  return (
    <h1 className={className} key={forceRefresh ? Date.now() : undefined}>
      {/* <span>{greeting.prefix}</span> */}
      <span ref={messageRef}>{greeting.message}</span>
    </h1>
  );
}
