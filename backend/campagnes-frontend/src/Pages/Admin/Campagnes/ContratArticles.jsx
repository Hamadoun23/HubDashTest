import { router, useForm } from '@inertiajs/react';
import { Card, CardHeader, CardTitle, CardBody } from '@/Components/ui/Card';
import { Input, Textarea, Label } from '@/Components/ui/Input';
import Button from '@/Components/ui/Button';

function ArticleEditForm({ campagneId, article }) {
    const { data, setData, put, processing } = useForm({ titre: article.titre, contenu: article.contenu });

    function save(e) {
        e.preventDefault();
        put(route('admin.campagnes.contrat-articles.update', [campagneId, article.id]));
    }

    function destroy() {
        if (confirm('Supprimer cet article ?')) {
            router.delete(route('admin.campagnes.contrat-articles.destroy', [campagneId, article.id]));
        }
    }

    return (
        <div className="rounded-lg border border-ardoise-200 bg-ardoise-50 p-4">
            <form onSubmit={save} className="space-y-2">
                <div>
                    <Label className="text-xs">Titre</Label>
                    <Input value={data.titre} onChange={(e) => setData('titre', e.target.value)} maxLength={255} required />
                </div>
                <div>
                    <Label className="text-xs">Contenu</Label>
                    <Textarea rows={5} value={data.contenu} onChange={(e) => setData('contenu', e.target.value)} maxLength={50000} required />
                </div>
                <div className="flex gap-2">
                    <Button type="submit" size="sm" disabled={processing}>Enregistrer cet article</Button>
                </div>
            </form>
            <Button type="button" variant="destructive" size="sm" className="mt-2" onClick={destroy}>Supprimer cet article</Button>
        </div>
    );
}

function NewArticleForm({ campagneId }) {
    const { data, setData, post, processing, reset } = useForm({ titre: '', contenu: '' });

    function submit(e) {
        e.preventDefault();
        post(route('admin.campagnes.contrat-articles.store', campagneId), { onSuccess: () => reset() });
    }

    return (
        <div className="rounded-lg border-2 border-marque-500/40 p-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ardoise-500">Nouvel article</p>
            <form onSubmit={submit} className="space-y-2">
                <div>
                    <Label className="text-xs">Titre</Label>
                    <Input value={data.titre} onChange={(e) => setData('titre', e.target.value)} maxLength={255} placeholder="Ex. Article 4 : …" required />
                </div>
                <div>
                    <Label className="text-xs">Contenu</Label>
                    <Textarea rows={4} value={data.contenu} onChange={(e) => setData('contenu', e.target.value)} maxLength={50000} placeholder="Texte de l'article" required />
                </div>
                <Button type="submit" size="sm" disabled={processing}>Ajouter l'article</Button>
            </form>
        </div>
    );
}

export default function ContratArticles({ campagneId, articles }) {
    return (
        <Card>
            <CardHeader><CardTitle>Articles du contrat de prestation</CardTitle></CardHeader>
            <CardBody className="space-y-3">
                <p className="text-sm text-ardoise-500">Texte affiché aux commerciaux entre l'en-tête et le bloc « Rémunération et aides ». Vous pouvez modifier, ajouter ou supprimer des articles.</p>
                {articles.map((article) => (
                    <ArticleEditForm key={article.id} campagneId={campagneId} article={article} />
                ))}
                <NewArticleForm campagneId={campagneId} />
            </CardBody>
        </Card>
    );
}
