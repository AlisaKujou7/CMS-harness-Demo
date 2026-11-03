import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import { Crumbs } from '../../../design-system/components/Crumbs';
import type { ContentDetail, ContentType } from '../../../shared/api/types';
import { useCurrentUser } from '../../../shared/stores/session.store';
import { contentMessages as m } from '../content.messages';
import { describeEditor, missingFieldsMessage } from '../editor-screen';
import { useContentEditor } from '../hooks/useContentEditor';
import { useEditorActions } from '../hooks/useEditorActions';
import { useEditorNavigation } from '../hooks/useEditorNavigation';
import { editorPath, listPath, type RichTextDoc } from '../types/content.types';
import { describeEditorPermission } from '../permissions';
import { EditorBanners } from './EditorBanners';
import { EditorMain } from './EditorMain';
import { EditorOverlays } from './EditorOverlays';
import { MetaPanelContainer } from './MetaPanelContainer';
import { PublishPanel } from './PublishPanel';
import { SeoPanel } from './SeoPanel';

export interface ContentEditorProps {
  readonly type: ContentType;
  readonly initial: ContentDetail | null;
  readonly initialBody: RichTextDoc;
  onCreated(content: ContentDetail): void;
  onOpen(path: string): void;
  onReload(): void;
}

// 03-DESIGN 12.4 and 04-ARCH 5.9
export function ContentEditorContainer(props: ContentEditorProps) {
  const { type, initial, initialBody, onCreated, onOpen, onReload } = props;
  const viewer = useCurrentUser();
  const editor = useContentEditor({
    type,
    initial,
    initialBody,
    canEdit: (item) => describeEditorPermission(viewer, item),
    onCreated: (created) => {
      navigation.allowNextNavigation();
      onCreated(created);
      navigation.navigationDone();
    },
  });
  const navigation = useEditorNavigation(editor.hasUnsaved);
  const leaveTo = (path: string) => {
    navigation.allowNextNavigation();
    onOpen(path);
  };
  const actions = useEditorActions({
    editor,
    type,
    onCopied: (copy) => {
      leaveTo(editorPath(type, copy.id));
    },
    onDeleted: () => {
      leaveTo(listPath(type));
    },
  });
  const { content, form } = editor;
  const { can, status, crumb, historyPath, scheduledLabel } = describeEditor(viewer, type, content);
  const save = () => void editor.saveNow();
  const { target } = actions;

  return (
    <>
      <Crumbs
        label={m.crumbsLabel}
        items={[{ label: m.plural[type], href: listPath(type) }, { label: crumb }]}
      />
      <EditorBanners
        banner={editor.banner ?? missingFieldsMessage(actions.publishError)}
        content={content}
        canEdit={can.canEdit}
        scheduledLabel={scheduledLabel}
        canCancelSchedule={can.canSchedule}
        onCancelSchedule={() => {
          if (target) actions.schedule.mutate({ target, at: null });
        }}
      />
      <Box
        sx={{
          display: 'grid',
          gap: 3,
          gridTemplateColumns: { lg: '8fr 4fr' },
          alignItems: 'start',
        }}
      >
        <EditorMain
          form={form}
          editable={can.canEdit}
          indicator={editor.indicator}
          initialBody={initialBody}
          onFieldBlur={save}
        />
        <Stack spacing={2} sx={{ position: { lg: 'sticky' }, top: { lg: 16 } }}>
          <PublishPanel
            {...actions.handlers}
            status={status}
            can={can}
            isNew={content === null}
            busy={actions.busy}
            historyPath={historyPath}
          />
          <SeoPanel form={form} disabled={!can.canEdit} content={content} onFieldBlur={save} />
          <MetaPanelContainer
            form={form}
            disabled={!can.canEdit}
            type={type}
            ownId={initial?.id ?? content?.id ?? null}
            onFieldBlur={save}
          />
        </Stack>
      </Box>
      <EditorOverlays
        type={type}
        title={form.getValues('title')}
        dialog={actions.dialog}
        conflict={editor.conflict}
        savingCopy={actions.saveCopy.isPending}
        blocker={navigation.blocker}
        onConfirm={actions.confirm}
        onClose={actions.close}
        onSchedule={(at) => {
          actions.close();
          if (target) actions.schedule.mutate({ target, at });
        }}
        onReject={(note) => {
          actions.close();
          if (target) actions.reject.mutate({ target, note });
        }}
        onReload={onReload}
        onSaveCopy={() => {
          actions.saveCopy.mutate(form.getValues());
        }}
      />
    </>
  );
}
