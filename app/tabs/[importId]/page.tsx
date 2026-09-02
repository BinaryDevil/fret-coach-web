import { PublicTabDetail } from "../../../components/public-tab-detail";
export default async function Page({ params }: { params: Promise<{ importId: string }> }) { const { importId } = await params; return <PublicTabDetail importId={importId}/>; }
