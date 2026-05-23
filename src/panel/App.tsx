import { useBootstrap } from './hooks/useBootstrap';
import { useMessaging } from './hooks/useMessaging';
import { TabBindingBar } from './components/TabBindingBar';
import { MappingHeader } from './components/MappingHeader';
import { NoMatchPrompt } from './components/NoMatchPrompt';
import { SelectionPanel } from './components/SelectionPanel';
import { IssueForm } from './components/IssueForm';
import { Toast } from './components/Toast';
import { InlineError } from './components/InlineError';

export function App() {
  useBootstrap();
  useMessaging();
  return (
    <div className="panel-root">
      <TabBindingBar />
      <MappingHeader />
      <NoMatchPrompt />
      <SelectionPanel />
      <InlineError />
      <IssueForm />
      <Toast />
    </div>
  );
}
