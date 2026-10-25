export const materialSelect = {
  id: true,
  title: true,
  kind: true,
  url: true,
  fileName: true,
  filePath: true,
} as const;

interface MaterialRow {
  id: number;
  title: string;
  kind: string;
  url: string;
  fileName: string | null;
  filePath: string | null;
}

export interface MaterialView {
  id: number;
  title: string;
  kind: string;
  url: string;
  fileName: string | null;
}

export function toMaterialView(row: MaterialRow): MaterialView {
  return {
    id: row.id,
    title: row.title,
    kind: row.kind,
    url: row.filePath ? `/api/materials/${row.id}/file` : row.url,
    fileName: row.fileName,
  };
}
