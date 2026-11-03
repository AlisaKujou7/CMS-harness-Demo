import Image from '@tiptap/extension-image';

// mediaId is what stays true when a signed src expires (ADR-0013).
export const MediaImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      mediaId: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-media-id'),
        renderHTML: (attributes: { mediaId?: string | null }) =>
          attributes.mediaId ? { 'data-media-id': attributes.mediaId } : {},
      },
    };
  },
});
