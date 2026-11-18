import { useNavigate, useParams } from 'react-router';
import { TableSkeleton } from '../../../design-system/components/Skeletons';
import type { ContentType } from '../../../shared/api/types';
import { QueryError } from '../../../shared/components/PageErrors';
import { common } from '../../../shared/i18n/common.messages';
import { ContentEditorContainer } from '../components/ContentEditorContainer';
import { useEditorSource } from '../hooks/useEditorSource';
import { editorPath } from '../types/content.types';

export interface ContentEditorPageProps {
  readonly type: ContentType;
}

export function ContentEditorPage({ type }: ContentEditorPageProps) {
  const { id = 'new' } = useParams();
  const navigate = useNavigate();
  const source = useEditorSource(id);

  if (source.failed) {
    return <QueryError error={source.query.error} onRetry={() => void source.query.refetch()} />;
  }
  if (source.loading) return <TableSkeleton label={common.loading} />;
  return (
    <ContentEditorContainer
      key={source.key}
      type={type}
      initial={source.initial}
      initialBody={source.initialBody}
      onCreated={(content) => {
        source.adoptCreated(content);
        void navigate(editorPath(type, content.id), { replace: true });
      }}
      onOpen={(path) => {
        void navigate(path);
      }}
      onReload={source.reload}
    />
  );
}
