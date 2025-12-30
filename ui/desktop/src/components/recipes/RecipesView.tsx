import { useState, useEffect, useMemo } from 'react';
import { listSavedRecipes, convertToLocaleDateString } from '../../recipe/recipe_management';
import {
  FileText,
  Edit,
  Trash2,
  Play,
  Calendar,
  AlertCircle,
  Link,
  Clock,
  Terminal,
  ExternalLink,
} from 'lucide-react';
import { ScrollArea } from '../ui/scroll-area';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Skeleton } from '../ui/skeleton';
import { MainPanelLayout } from '../Layout/MainPanelLayout';
import { toastSuccess } from '../../toasts';
import { useEscapeKey } from '../../hooks/useEscapeKey';
import {
  deleteRecipe,
  RecipeManifest,
  startAgent,
  scheduleRecipe,
  setRecipeSlashCommand,
} from '../../api';
import ImportRecipeForm, { ImportRecipeButton } from './ImportRecipeForm';
import CreateEditRecipeModal from './CreateEditRecipeModal';
import { generateDeepLink, Recipe } from '../../recipe';
import { useNavigation } from '../../hooks/useNavigation';
import { CronPicker } from '../schedule/CronPicker';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { SearchView } from '../conversation/SearchView';
import cronstrue from 'cronstrue';
import {
  trackRecipeDeleted,
  trackRecipeStarted,
  trackRecipeDeeplinkCopied,
  trackRecipeScheduled,
  trackRecipeSlashCommandSet,
  getErrorType,
} from '../../utils/analytics';

export default function RecipesView() {
  const setView = useNavigation();
  const [savedRecipes, setSavedRecipes] = useState<RecipeManifest[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSkeleton, setShowSkeleton] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedRecipe, setSelectedRecipe] = useState<RecipeManifest | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [showContent, setShowContent] = useState(false);

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);

  const [showScheduleDialog, setShowScheduleDialog] = useState(false);
  const [scheduleRecipeManifest, setScheduleRecipeManifest] = useState<RecipeManifest | null>(null);
  const [scheduleCron, setScheduleCron] = useState<string>('');

  const [showSlashCommandDialog, setShowSlashCommandDialog] = useState(false);
  const [slashCommandRecipeManifest, setSlashCommandRecipeManifest] =
    useState<RecipeManifest | null>(null);
  const [slashCommand, setSlashCommand] = useState<string>('');
  const [scheduleValid, setScheduleIsValid] = useState(true);

  const [searchTerm, setSearchTerm] = useState('');

  const filteredRecipes = useMemo(() => {
    if (!searchTerm) return savedRecipes;

    const searchLower = searchTerm.toLowerCase();
    return savedRecipes.filter((recipeManifest) => {
      const { recipe, slash_command } = recipeManifest;
      const title = recipe.title?.toLowerCase() || '';
      const description = recipe.description?.toLowerCase() || '';
      const slashCmd = slash_command?.toLowerCase() || '';

      return (
        title.includes(searchLower) ||
        description.includes(searchLower) ||
        slashCmd.includes(searchLower)
      );
    });
  }, [savedRecipes, searchTerm]);

  useEffect(() => {
    loadSavedRecipes();
  }, []);

  useEscapeKey(showEditor, () => setShowEditor(false));

  useEffect(() => {
    if (!loading && showSkeleton) {
      const timer = setTimeout(() => {
        setShowSkeleton(false);
        setTimeout(() => {
          setShowContent(true);
        }, 50);
      }, 300);

      return () => clearTimeout(timer);
    }
    return () => void 0;
  }, [loading, showSkeleton]);

  const loadSavedRecipes = async () => {
    try {
      setLoading(true);
      setShowSkeleton(true);
      setShowContent(false);
      setError(null);
      const recipeManifestResponses = await listSavedRecipes();
      setSavedRecipes(recipeManifestResponses);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'レシピの読み込みに失敗しました');
      console.error('Failed to load saved recipes:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleStartRecipeChat = async (recipe: Recipe, _recipeId: string) => {
    try {
      const newAgent = await startAgent({
        body: {
          working_dir: window.appConfig.get('GOOSE_WORKING_DIR') as string,
          recipe,
        },
        throwOnError: true,
      });
      const session = newAgent.data;
      trackRecipeStarted(true, undefined, false);
      setView('pair', {
        disableAnimation: true,
        resumeSessionId: session.id,
      });
    } catch (error) {
      console.error('Failed to load recipe:', error);
      const errorMsg = error instanceof Error ? error.message : 'レシピの読み込みに失敗しました';
      trackRecipeStarted(false, getErrorType(error), false);
      setError(errorMsg);
    }
  };

  const handleStartRecipeChatInNewWindow = (recipeId: string) => {
    try {
      window.electron.createChatWindow(
        undefined,
        window.appConfig.get('GOOSE_WORKING_DIR') as string,
        undefined,
        undefined,
        'pair',
        recipeId
      );
      trackRecipeStarted(true, undefined, true);
    } catch (error) {
      console.error('Failed to open recipe in new window:', error);
      trackRecipeStarted(false, getErrorType(error), true);
    }
  };

  const handleDeleteRecipe = async (recipeManifest: RecipeManifest) => {
    const result = await window.electron.showMessageBox({
      type: 'warning',
      buttons: ['キャンセル', '削除'],
      defaultId: 0,
      title: 'レシピを削除',
      message: `「${recipeManifest.recipe.title}」を削除してもよろしいですか？`,
      detail: 'レシピファイルが削除されます。',
    });

    if (result.response !== 1) {
      return;
    }

    try {
      await deleteRecipe({ body: { id: recipeManifest.id } });
      trackRecipeDeleted(true);
      await loadSavedRecipes();
      toastSuccess({
        title: recipeManifest.recipe.title,
        msg: 'レシピを削除しました',
      });
    } catch (err) {
      console.error('Failed to delete recipe:', err);
      const errorMsg = err instanceof Error ? err.message : 'レシピの削除に失敗しました';
      trackRecipeDeleted(false, getErrorType(err));
      setError(errorMsg);
    }
  };

  const handleEditRecipe = async (recipeManifest: RecipeManifest) => {
    setSelectedRecipe(recipeManifest);
    setShowEditor(true);
  };

  const handleEditorClose = (wasSaved?: boolean) => {
    setShowEditor(false);
    setSelectedRecipe(null);
    if (wasSaved) {
      loadSavedRecipes();
    }
  };

  const handleCopyDeeplink = async (recipeManifest: RecipeManifest) => {
    try {
      const deeplink = await generateDeepLink(recipeManifest.recipe);
      await navigator.clipboard.writeText(deeplink);
      trackRecipeDeeplinkCopied(true);
      toastSuccess({
        title: 'ディープリンクをコピーしました',
        msg: 'レシピのディープリンクがクリップボードにコピーされました',
      });
    } catch (error) {
      console.error('Failed to copy deeplink:', error);
      trackRecipeDeeplinkCopied(false, getErrorType(error));
      toastSuccess({
        title: 'コピー失敗',
        msg: 'ディープリンクのクリップボードへのコピーに失敗しました',
      });
    }
  };

  const handleOpenScheduleDialog = (recipeManifest: RecipeManifest) => {
    setScheduleRecipeManifest(recipeManifest);
    setScheduleCron(recipeManifest.schedule_cron || '0 0 14 * * *');
    setShowScheduleDialog(true);
  };

  const handleSaveSchedule = async () => {
    if (!scheduleRecipeManifest) return;

    const action = scheduleRecipeManifest.schedule_cron ? 'edit' : 'add';

    try {
      await scheduleRecipe({
        body: {
          id: scheduleRecipeManifest.id,
          cron_schedule: scheduleCron,
        },
      });

      trackRecipeScheduled(true, action);
      toastSuccess({
        title: 'スケジュールを保存しました',
        msg: `レシピは${getReadableCron(scheduleCron)}に実行されます`,
      });

      setShowScheduleDialog(false);
      setScheduleRecipeManifest(null);
      await loadSavedRecipes();
    } catch (error) {
      console.error('Failed to save schedule:', error);
      const errorMsg = error instanceof Error ? error.message : 'スケジュールの保存に失敗しました';
      trackRecipeScheduled(false, action, getErrorType(error));
      setError(errorMsg);
    }
  };

  const handleRemoveSchedule = async () => {
    if (!scheduleRecipeManifest) return;

    try {
      await scheduleRecipe({
        body: {
          id: scheduleRecipeManifest.id,
          cron_schedule: null,
        },
      });

      trackRecipeScheduled(true, 'remove');
      toastSuccess({
        title: 'スケジュールを削除しました',
        msg: 'レシピは自動的に実行されなくなります',
      });

      setShowScheduleDialog(false);
      setScheduleRecipeManifest(null);
      await loadSavedRecipes();
    } catch (error) {
      console.error('Failed to remove schedule:', error);
      const errorMsg = error instanceof Error ? error.message : 'スケジュールの削除に失敗しました';
      trackRecipeScheduled(false, 'remove', getErrorType(error));
      setError(errorMsg);
    }
  };

  const handleOpenSlashCommandDialog = (recipeManifest: RecipeManifest) => {
    setSlashCommandRecipeManifest(recipeManifest);
    setSlashCommand(recipeManifest.slash_command || '');
    setShowSlashCommandDialog(true);
  };

  const handleSaveSlashCommand = async () => {
    if (!slashCommandRecipeManifest) return;

    const action = slashCommand
      ? slashCommandRecipeManifest.slash_command
        ? 'edit'
        : 'add'
      : 'remove';

    try {
      await setRecipeSlashCommand({
        body: {
          id: slashCommandRecipeManifest.id,
          slash_command: slashCommand || null,
        },
      });

      trackRecipeSlashCommandSet(true, action);
      toastSuccess({
        title: 'スラッシュコマンドを保存しました',
        msg: slashCommand ? `/${slashCommand} でこのレシピを実行できます` : 'スラッシュコマンドを削除しました',
      });

      setShowSlashCommandDialog(false);
      setSlashCommandRecipeManifest(null);
      await loadSavedRecipes();
    } catch (error) {
      console.error('Failed to save slash command:', error);
      const errorMsg = error instanceof Error ? error.message : 'スラッシュコマンドの保存に失敗しました';
      trackRecipeSlashCommandSet(false, action, getErrorType(error));
      setError(errorMsg);
    }
  };

  const handleRemoveSlashCommand = async () => {
    if (!slashCommandRecipeManifest) return;

    try {
      await setRecipeSlashCommand({
        body: {
          id: slashCommandRecipeManifest.id,
          slash_command: null,
        },
      });

      trackRecipeSlashCommandSet(true, 'remove');
      toastSuccess({
        title: 'スラッシュコマンドを削除しました',
        msg: 'レシピのスラッシュコマンドが削除されました',
      });

      setShowSlashCommandDialog(false);
      setSlashCommandRecipeManifest(null);
      await loadSavedRecipes();
    } catch (error) {
      console.error('Failed to remove slash command:', error);
      const errorMsg = error instanceof Error ? error.message : 'スラッシュコマンドの削除に失敗しました';
      trackRecipeSlashCommandSet(false, 'remove', getErrorType(error));
      setError(errorMsg);
    }
  };

  const getReadableCron = (cron: string): string => {
    try {
      const cronWithoutSeconds = cron.split(' ').slice(1).join(' ');
      return cronstrue.toString(cronWithoutSeconds).toLowerCase();
    } catch {
      return cron;
    }
  };

  const RecipeItem = ({
    recipeManifestResponse,
    recipeManifestResponse: { recipe, last_modified: lastModified, schedule_cron, slash_command },
  }: {
    recipeManifestResponse: RecipeManifest;
  }) => (
    <Card className="py-2 px-4 mb-2 bg-background-default border-none hover:bg-background-muted transition-all duration-150">
      <div className="flex justify-between items-start gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-base truncate max-w-[50vw]">{recipe.title}</h3>
          </div>
          <p className="text-text-muted text-sm mb-2 line-clamp-2">{recipe.description}</p>
          <div className="flex flex-col gap-1 text-xs text-text-muted">
            <div className="flex items-center">
              <Calendar className="w-3 h-3 mr-1" />
              {convertToLocaleDateString(lastModified)}
            </div>
            {(schedule_cron || slash_command) && (
              <div className="flex items-center gap-3">
                {schedule_cron && (
                  <div className="flex items-center text-blue-600 dark:text-blue-400">
                    <Clock className="w-3 h-3 mr-1" />
                    Runs {getReadableCron(schedule_cron)}
                  </div>
                )}
                {slash_command && (
                  <div className="flex items-center text-purple-600 dark:text-purple-400">
                    /{slash_command}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <Button
          onClick={(e) => {
            e.stopPropagation();
            handleOpenSlashCommandDialog(recipeManifestResponse);
          }}
          variant={slash_command ? 'default' : 'outline'}
          size="sm"
          className="h-8 w-8 p-0"
          title={slash_command ? 'Edit slash command' : 'Add slash command'}
        >
          <Terminal className="w-4 h-4" />
        </Button>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            onClick={(e) => {
              e.stopPropagation();
              handleStartRecipeChat(recipe, recipeManifestResponse.id);
            }}
            size="sm"
            className="h-8 w-8 p-0"
            title="レシピを使用"
          >
            <Play className="w-4 h-4" />
          </Button>
          <Button
            onClick={(e) => {
              e.stopPropagation();
              handleStartRecipeChatInNewWindow(recipeManifestResponse.id);
            }}
            variant="outline"
            size="sm"
            className="h-8 w-8 p-0"
            title="新しいウィンドウで開く"
          >
            <ExternalLink className="w-4 h-4" />
          </Button>
          <Button
            onClick={(e) => {
              e.stopPropagation();
              handleEditRecipe(recipeManifestResponse);
            }}
            variant="outline"
            size="sm"
            className="h-8 w-8 p-0"
            title="レシピを編集"
          >
            <Edit className="w-4 h-4" />
          </Button>
          <Button
            onClick={(e) => {
              e.stopPropagation();
              handleCopyDeeplink(recipeManifestResponse);
            }}
            variant="outline"
            size="sm"
            className="h-8 w-8 p-0"
            title="ディープリンクをコピー"
          >
            <Link className="w-4 h-4" />
          </Button>
          <Button
            onClick={(e) => {
              e.stopPropagation();
              handleOpenScheduleDialog(recipeManifestResponse);
            }}
            variant={schedule_cron ? 'default' : 'outline'}
            size="sm"
            className="h-8 w-8 p-0"
            title={schedule_cron ? 'スケジュールを編集' : 'スケジュールを追加'}
          >
            <Clock className="w-4 h-4" />
          </Button>
          <Button
            onClick={(e) => {
              e.stopPropagation();
              handleDeleteRecipe(recipeManifestResponse);
            }}
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
            title="レシピを削除"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </Card>
  );

  const RecipeSkeleton = () => (
    <Card className="p-2 mb-2 bg-background-default">
      <div className="flex justify-between items-start gap-4">
        <div className="min-w-0 flex-1">
          <Skeleton className="h-5 w-3/4 mb-2" />
          <Skeleton className="h-4 w-full mb-2" />
          <Skeleton className="h-4 w-24" />
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Skeleton className="h-8 w-8" />
          <Skeleton className="h-8 w-8" />
          <Skeleton className="h-8 w-8" />
          <Skeleton className="h-8 w-8" />
          <Skeleton className="h-8 w-8" />
        </div>
      </div>
    </Card>
  );

  const renderContent = () => {
    if (loading || showSkeleton) {
      return (
        <div className="space-y-6">
          <div className="space-y-3">
            <Skeleton className="h-6 w-24" />
            <div className="space-y-2">
              <RecipeSkeleton />
              <RecipeSkeleton />
              <RecipeSkeleton />
            </div>
          </div>
        </div>
      );
    }

    if (error) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-text-muted">
          <AlertCircle className="h-12 w-12 text-red-500 mb-4" />
          <p className="text-lg mb-2">レシピの読み込みエラー</p>
          <p className="text-sm text-center mb-4">{error}</p>
          <Button onClick={loadSavedRecipes} variant="default">
            再試行
          </Button>
        </div>
      );
    }

    if (savedRecipes.length === 0) {
      return (
        <div className="flex flex-col justify-center pt-2 h-full">
          <p className="text-lg">保存されたレシピがありません</p>
          <p className="text-sm text-text-muted">チャットから保存されたレシピがここに表示されます。</p>
        </div>
      );
    }

    if (filteredRecipes.length === 0 && searchTerm) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-text-muted mt-4">
          <FileText className="h-12 w-12 mb-4" />
          <p className="text-lg mb-2">一致するレシピが見つかりません</p>
          <p className="text-sm">検索条件を調整してみてください</p>
        </div>
      );
    }

    return (
      <div className="space-y-2">
        {filteredRecipes.map((recipeManifestResponse: RecipeManifest) => (
          <RecipeItem
            key={recipeManifestResponse.id}
            recipeManifestResponse={recipeManifestResponse}
          />
        ))}
      </div>
    );
  };

  return (
    <>
      <MainPanelLayout>
        <div className="flex-1 flex flex-col min-h-0">
          <div className="bg-background-default px-8 pb-8 pt-16">
            <div className="flex flex-col page-transition">
              <div className="flex justify-between items-center mb-1">
                <h1 className="text-4xl font-light">レシピ</h1>
                <div className="flex gap-2">
                  <Button
                    onClick={() => setShowCreateDialog(true)}
                    variant="outline"
                    size="sm"
                    className="flex items-center gap-2"
                  >
                    <FileText className="w-4 h-4" />
                    レシピを作成
                  </Button>
                  <ImportRecipeButton onClick={() => setShowImportDialog(true)} />
                </div>
              </div>
              <p className="text-sm text-text-muted mb-1">
                保存したレシピを表示・管理して、事前定義された設定で新しいセッションをすばやく開始できます。
                ⌘F/Ctrl+F で検索。
              </p>
            </div>
          </div>

          <div className="flex-1 min-h-0 relative px-8">
            <ScrollArea className="h-full">
              <SearchView onSearch={(term) => setSearchTerm(term)} placeholder="レシピを検索...">
                <div
                  className={`h-full relative transition-all duration-300 ${
                    showContent ? 'opacity-100 animate-in fade-in ' : 'opacity-0'
                  }`}
                >
                  {renderContent()}
                </div>
              </SearchView>
            </ScrollArea>
          </div>
        </div>
      </MainPanelLayout>

      {showEditor && selectedRecipe && (
        <CreateEditRecipeModal
          isOpen={showEditor}
          onClose={handleEditorClose}
          recipe={selectedRecipe.recipe}
          recipeId={selectedRecipe.id}
        />
      )}

      <ImportRecipeForm
        isOpen={showImportDialog}
        onClose={() => setShowImportDialog(false)}
        onSuccess={loadSavedRecipes}
      />

      {showCreateDialog && (
        <CreateEditRecipeModal
          isOpen={showCreateDialog}
          onClose={() => {
            setShowCreateDialog(false);
            loadSavedRecipes();
          }}
          isCreateMode={true}
        />
      )}

      {showScheduleDialog && scheduleRecipeManifest && (
        <Dialog open={showScheduleDialog} onOpenChange={setShowScheduleDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                スケジュールを{scheduleRecipeManifest.schedule_cron ? '編集' : '追加'}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <CronPicker
                schedule={
                  scheduleRecipeManifest.schedule_cron
                    ? {
                        id: scheduleRecipeManifest.id,
                        source: '',
                        cron: scheduleRecipeManifest.schedule_cron,
                        last_run: null,
                        currently_running: false,
                        paused: false,
                      }
                    : null
                }
                onChange={setScheduleCron}
                isValid={setScheduleIsValid}
              />
              <div className="flex gap-2 justify-end">
                {scheduleRecipeManifest.schedule_cron && (
                  <Button variant="outline" onClick={handleRemoveSchedule}>
                    スケジュールを削除
                  </Button>
                )}
                <Button variant="outline" onClick={() => setShowScheduleDialog(false)}>
                  キャンセル
                </Button>
                <Button onClick={handleSaveSchedule} disabled={!scheduleValid}>
                  保存
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {showSlashCommandDialog && slashCommandRecipeManifest && (
        <Dialog open={showSlashCommandDialog} onOpenChange={setShowSlashCommandDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>スラッシュコマンド</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground mb-3">
                  スラッシュコマンドを設定して、任意のチャットからこのレシピをすばやく実行できます
                </p>
                <div className="flex gap-2 items-center">
                  <span className="text-muted-foreground">/</span>
                  <input
                    type="text"
                    value={slashCommand}
                    onChange={(e) => setSlashCommand(e.target.value)}
                    placeholder="コマンド名"
                    className="flex-1 px-3 py-2 border rounded text-sm"
                  />
                </div>
                {slashCommand && (
                  <p className="text-xs text-muted-foreground mt-2">
                    任意のチャットで /{slashCommand} を使用してこのレシピを実行できます
                  </p>
                )}
              </div>

              <div className="flex gap-2 justify-end">
                {slashCommandRecipeManifest.slash_command && (
                  <Button variant="outline" onClick={handleRemoveSlashCommand}>
                    削除
                  </Button>
                )}
                <Button variant="outline" onClick={() => setShowSlashCommandDialog(false)}>
                  キャンセル
                </Button>
                <Button onClick={handleSaveSlashCommand}>保存</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
