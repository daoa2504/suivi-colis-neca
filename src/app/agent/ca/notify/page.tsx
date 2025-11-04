// src/app/agent/ca/notify/page.tsx
import NotifyByConvoyForm from "./NotifyByConvoyForm";

export default function Page() {
    return (
        <main className="container-page">
            <div className="card">
                <h1 className="title">Notifier un convoi — CA → GN</h1>
                <NotifyByConvoyForm direction="NE_TO_CA" />
            </div>
        </main>
    );
}