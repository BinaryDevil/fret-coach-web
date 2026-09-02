import { ImportedSongDetail } from "../../../components/imported-song-detail";
export default async function Page({ params }: { params: Promise<{ importId: string }> }) { const { importId } = await params; return <ImportedSongDetail importId={importId}/>; }
