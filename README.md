# RepoVerse

Yerel kod depolarını ve public website yüzeylerini analiz edip Three.js tabanlı bir 3D architecture intelligence grafiğine dönüştüren local-first monorepo.

## Çalıştırma

### Backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

API, repo kökünden `uvicorn backend.main:app` biçiminde de import edilebilir.

### Frontend

Yeni bir terminalde:

```bash
cd frontend
npm install
npm run dev
```

Ardından [http://localhost:3000](http://localhost:3000) adresini açın ve taranacak yerel klasörün mutlak yolunu girin.

### Yerel Ollama

Özetleme isteğe bağlıdır. Ollama çalışmıyorsa arayüz otomatik olarak statik analiz fallback özetini gösterir.

```bash
ollama serve
ollama pull qwen2.5
```

İsterseniz `OLLAMA_MODEL` ve `OLLAMA_URL` ortam değişkenleriyle backend varsayılanlarını değiştirebilirsiniz. Frontend API adresi için de `NEXT_PUBLIC_API_URL` kullanılabilir; varsayılan değer `http://localhost:8000`.

### Website architecture modu

Arayüzde `Web` sekmesini seçip `https://example.com` gibi bir URL girin. Crawler aynı origin içindeki sınırlı sayıda HTML sayfasını, script/stylesheet/image assetlerini ve HTML/header teknolojisi sinyallerini çıkarır. Graph; site kökü, sayfalar, assetler, sayfa ilişkileri ve tespit edilen teknolojileri ayrı node tipleri olarak gösterir.

Bu mod public ve erişilebilir yüzey içindir; login gerektiren sayfaları, client-side route’ları ve runtime network çağrılarını eksiksiz görebilmek için bir sonraki katmanda Playwright browser instrumentation eklenebilir. Bu ayrım bilinçlidir: statik HTML crawler hızlı ve dependency-light kalır, browser instrumentation ise gerçek render/network davranışını yakalar.

## Veri akışı

1. `POST /api/scan`, `.py`, `.js`, `.ts` ve `.tsx` dosyalarını tarar.
2. `POST /api/scan-url`, same-origin HTML sayfalarını ve public asset/technology sinyallerini tarar.
3. Python AST; fonksiyon, sınıf ve import bilgilerini çıkarır. JS/TS tarafında dış bağımlılık gerektirmeyen import/fonksiyon/sınıf desenleri kullanılır.
4. Repo içi importlar ve website içi sayfa/asset ilişkileri `edges` olarak döner.
5. Repo düğümüne tıklanınca `POST /api/summary` yerel Ollama’dan iki cümlelik teknik özet ister; website node’ları public architecture brief gösterir.
6. Three.js `OrbitControls` + GSAP camera director; intro fly-in, auto-orbit, node focus ve reset view akışlarını yönetir.

## Doğrulama

```bash
python3 -m compileall -q backend
cd frontend && npm run typecheck && npm run build
```
