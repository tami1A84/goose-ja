import { useState, useEffect, useRef } from 'react';
import { useConfig } from './ConfigContext';
import {
  checkOllamaStatus,
  getOllamaDownloadUrl,
  pollForOllama,
  hasModel,
  pullOllamaModel,
  getPreferredModel,
  type PullProgress,
} from '../utils/ollamaDetection';
//import { initializeSystem } from '../utils/providerUtils';
import { toastService } from '../toasts';
import { Ollama } from './icons';

interface OllamaSetupProps {
  onSuccess: () => void;
  onCancel: () => void;
}

export function OllamaSetup({ onSuccess, onCancel }: OllamaSetupProps) {
  //const { addExtension, getExtensions, upsert } = useConfig();
  const { upsert } = useConfig();
  const [isChecking, setIsChecking] = useState(true);
  const [ollamaDetected, setOllamaDetected] = useState(false);
  const [isPolling, setIsPolling] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [modelStatus, setModelStatus] = useState<
    'checking' | 'available' | 'not-available' | 'downloading'
  >('checking');
  const [downloadProgress, setDownloadProgress] = useState<PullProgress | null>(null);
  const stopPollingRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    // Check if Ollama is already running
    const checkInitial = async () => {
      const status = await checkOllamaStatus();
      setOllamaDetected(status.isRunning);

      // If Ollama is running, check for the preferred model
      if (status.isRunning) {
        const modelAvailable = await hasModel(getPreferredModel());
        setModelStatus(modelAvailable ? 'available' : 'not-available');
      }

      setIsChecking(false);
    };
    checkInitial();

    // Cleanup polling on unmount
    return () => {
      if (stopPollingRef.current) {
        stopPollingRef.current();
      }
    };
  }, []);

  const handleInstallClick = () => {
    setIsPolling(true);

    // Start polling for Ollama
    stopPollingRef.current = pollForOllama(
      async (status) => {
        setOllamaDetected(status.isRunning);
        setIsPolling(false);

        // Check for the model
        const modelAvailable = await hasModel(getPreferredModel());
        setModelStatus(modelAvailable ? 'available' : 'not-available');

        toastService.success({
          title: 'Ollamaを検出しました！',
          msg: 'Ollamaが実行中です。接続できます。',
        });
      },
      3000 // Check every 3 seconds
    );
  };

  const handleDownloadModel = async () => {
    setModelStatus('downloading');
    setDownloadProgress({ status: 'ダウンロードを開始中...' });

    const success = await pullOllamaModel(getPreferredModel(), (progress) => {
      setDownloadProgress(progress);
    });

    if (success) {
      setModelStatus('available');
      toastService.success({
        title: 'モデルをダウンロードしました！',
        msg: `${getPreferredModel()}を正常にダウンロードしました`,
      });
    } else {
      setModelStatus('not-available');
      toastService.error({
        title: 'ダウンロード失敗',
        msg: `${getPreferredModel()}のダウンロードに失敗しました。再試行してください。`,
        traceback: '',
      });
    }
    setDownloadProgress(null);
  };

  const handleConnectOllama = async () => {
    setIsConnecting(true);
    try {
      // Set up Ollama configuration
      await upsert('GOOSE_PROVIDER', 'ollama', false);
      await upsert('GOOSE_MODEL', getPreferredModel(), false);
      await upsert('OLLAMA_HOST', 'localhost', false);

      toastService.success({
        title: '成功！',
        msg: `${getPreferredModel()}モデルでOllamaに接続しました。`,
      });

      onSuccess();
    } catch (error) {
      console.error('Failed to connect to Ollama:', error);
      toastService.error({
        title: '接続失敗',
        msg: `Ollamaへの接続に失敗しました: ${error instanceof Error ? error.message : String(error)}`,
        traceback: error instanceof Error ? error.stack || '' : '',
      });
      setIsConnecting(false);
    }
  };

  if (isChecking) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-textStandard"></div>
        </div>
        <p className="text-center text-text-muted">Ollamaを確認中...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with icon above heading - left aligned like onboarding cards */}
      <div className="text-left">
        <Ollama className="w-6 h-6 mb-3 text-text-standard" />
        <h3 className="text-lg font-semibold text-text-standard mb-2">Ollamaセットアップ</h3>
        <p className="text-text-muted">
          Ollamaを使えば、AIモデルを無料で、プライベートに、ローカルコンピュータで実行できます。
        </p>
      </div>

      {ollamaDetected ? (
        <div className="space-y-4">
          <div className="flex items-start mb-16">
            <span className="inline-block px-2 py-1 text-xs font-medium bg-green-600 text-white rounded-full">
              Ollamaが検出され、実行中です
            </span>
          </div>

          {modelStatus === 'checking' ? (
            <div className="flex items-center justify-center py-4">
              <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-textStandard"></div>
            </div>
          ) : modelStatus === 'not-available' ? (
            <div className="space-y-4">
              <div className="flex items-start mb-16">
                <p className="text-text-warning text-sm">
                  {getPreferredModel()}モデルがインストールされていません
                </p>
                <p className="text-text-muted text-xs mt-1">
                  このモデルはGooseで最高のエクスペリエンスを得るために推奨されています
                </p>
              </div>
              <button
                onClick={handleDownloadModel}
                disabled={false}
                className="w-full px-6 py-3 bg-background-muted text-text-standard rounded-lg hover:bg-background-hover transition-colors font-medium flex items-center justify-center gap-2"
              >
                {getPreferredModel()}をダウンロード（約11GB）
              </button>
            </div>
          ) : modelStatus === 'downloading' ? (
            <div className="space-y-4">
              <div className="bg-background-info/10 border border-border-info rounded-lg p-4">
                <p className="text-text-info text-sm">{getPreferredModel()}をダウンロード中...</p>
                {downloadProgress && (
                  <>
                    <p className="text-text-muted text-xs mt-2">{downloadProgress.status}</p>
                    {downloadProgress.total && downloadProgress.completed && (
                      <div className="mt-3">
                        <div className="bg-background-muted rounded-full h-2 overflow-hidden">
                          <div
                            className="bg-background-primary h-full transition-all duration-300"
                            style={{
                              width: `${(downloadProgress.completed / downloadProgress.total) * 100}%`,
                            }}
                          />
                        </div>
                        <p className="text-text-muted text-xs mt-1">
                          {Math.round((downloadProgress.completed / downloadProgress.total) * 100)}%
                        </p>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          ) : (
            <button
              onClick={handleConnectOllama}
              disabled={isConnecting}
              className="w-full px-6 py-3 bg-background-muted text-text-standard rounded-lg hover:bg-background-hover transition-colors font-medium flex items-center justify-center gap-2"
            >
              {isConnecting ? '接続中...' : 'OllamaでGooseを使用'}
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-start mb-16">
            <span className="inline-block px-2 py-1 text-xs font-medium bg-orange-600 text-white rounded-full">
              システムでOllamaが検出されませんでした
            </span>
          </div>

          {isPolling ? (
            <div className="space-y-4">
              <div className="flex items-center justify-center py-4">
                <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-textStandard"></div>
              </div>
              <p className="text-text-muted text-sm">Ollamaの起動を待っています...</p>
              <p className="text-text-muted text-xs">
                Ollamaがインストールされて実行されると、自動的に検出されます。
              </p>
            </div>
          ) : (
            <a
              href={getOllamaDownloadUrl()}
              target="_blank"
              rel="noopener noreferrer"
              onClick={handleInstallClick}
              className="block w-full px-6 py-3 bg-background-muted text-text-standard rounded-lg hover:bg-background-hover transition-colors font-medium text-center"
            >
              Ollamaをインストール
            </a>
          )}
        </div>
      )}

      <button
        onClick={onCancel}
        className="w-full px-6 py-3 bg-transparent text-text-muted rounded-lg hover:bg-background-muted transition-colors"
      >
        キャンセル
      </button>
    </div>
  );
}
