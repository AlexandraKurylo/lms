export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export const UPLOAD_ACCEPT =
  '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.odt,.txt,.md,.csv,.zip,.png,.jpg,.jpeg,.gif,.webp,.py,.cpp,.c,.h,.java,.js,.ts,.json,.ipynb,.sql';

export function fileProblem(file: File): string {
  return file.size > MAX_UPLOAD_BYTES ? 'Файл завеликий, максимум 10 МБ' : '';
}
