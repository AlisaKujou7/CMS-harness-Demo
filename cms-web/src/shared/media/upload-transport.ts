import { Observable } from 'rxjs';
import { ApiError, networkError } from '../api/api-error';
import type { PresignedUpload } from '../api/types';

// Fetch cannot report upload progress, so this one call uses XMLHttpRequest (FR-MEDIA-04). The
// presigned URL goes to storage directly, with none of the API's credentials.
export function putFile(upload: PresignedUpload, file: File): Observable<number> {
  return new Observable<number>((subscriber) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', upload.upload_url);
    for (const [name, value] of Object.entries(upload.headers)) xhr.setRequestHeader(name, value);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) subscriber.next(event.loaded / event.total);
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        subscriber.next(1);
        subscriber.complete();
      } else {
        subscriber.error(
          new ApiError({ status: xhr.status, code: 'UPLOAD_FAILED', message: xhr.statusText }),
        );
      }
    };
    xhr.onerror = () => {
      subscriber.error(networkError('The upload could not reach storage'));
    };
    xhr.send(file);
    return () => {
      xhr.abort();
    };
  });
}
