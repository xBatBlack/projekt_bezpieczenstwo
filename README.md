# Bezpieczeństwo Aplikacji Webowych - Projekt Zaliczeniowy

**Autor:** Michał Downarowicz
## Opis Projektu

Projekt to w pełni funkcjonalna aplikacja "Notatnik" demonstrująca zasady bezpieczeństwa aplikacji webowych, w szczególności bezpieczne logowanie i dostęp do zasobów przy użyciu protokołu **OAuth 2.0 z rozszerzeniem PKCE (Proof Key for Code Exchange)**. Dodatkowo implementuje autoryzację opartą na rolach (RBAC).

Aplikacja składa się z 3 głównych komponentów:
1. **Auth Server (Port 4000)** - Dedykowany serwer autoryzacyjny. Implementuje endpointy `/authorize`, `/login` i `/token`. Zarządza przepływem OAuth 2.0 PKCE oraz wydaje tokeny dostępowe (Access Token) w formacie JWT.
2. **Backend / Resource Server (Port 3000)** - Serwer zasobów REST API. Chroni endpointy weryfikując token JWT. Posiada endpointy otwarte (np. `/health`), zamknięte dla zalogowanych (np. `/api/notes`) oraz zależne od ról (np. `/api/admin/stats` tylko dla roli `admin`).
3. **Frontend (Port 5173)** - Aplikacja SPA w React (Vite). Bezpiecznie loguje się za pomocą Auth Servera korzystając z przepływu Authorization Code Flow z PKCE. Nie przechowuje hasła, a jedynie operuje wymianą kodu autoryzacyjnego na token.

## Instrukcja Uruchomienia

Wymagania: Zainstalowany Node.js (v18+)

### 1. Uruchomienie Serwera Autoryzacji (Auth Server)
Otwórz terminal w katalogu projektu i wykonaj:
```bash
cd auth-server
npm install
node index.js
```
Serwer uruchomi się na `http://localhost:4000` i automatycznie utworzy testową bazę danych `auth.db` z dwoma kontami:
- **Admin:** `admin` / `admin123`
- **Użytkownik:** `user` / `user123`

### 2. Uruchomienie Serwera Zasobów (Backend)
Otwórz drugi terminal:
```bash
cd backend
npm install
node index.js
```
Serwer uruchomi się na `http://localhost:3000`.

### 3. Uruchomienie aplikacji Frontendowej (React)
Otwórz trzeci terminal:
```bash
cd frontend
npm install
npm run dev
```
Aplikacja uruchomi się na `http://localhost:5173`.

## Testowanie funkcjonalności
1. Wejdź na `http://localhost:5173`.
2. Kliknij **"Login with OAuth 2.0 (PKCE)"**. Zostaniesz przekierowany na serwer autoryzacji (port 4000). Aplikacja w tle wygenerowała `code_verifier` (zapisany lokalnie) i wysłała jego hash `code_challenge`.
3. Zaloguj się na konto `admin` / `admin123`.
4. Po pomyślnym logowaniu wrócisz na port 5173 z tymczasowym kodem (tzw. Authorization Code). Frontend pod spodem wysyła ten kod oraz swój sekretny `code_verifier` na `/token`, udowadniając w ten sposób, że to on rozpoczął logowanie.
5. Zostaniesz przeniesiony do Notatnika.
6. Spróbuj dodać i usunąć notatkę.
7. W sekcji "Admin Area" kliknij **"Fetch Admin Stats"**. Zobaczysz pomyślnie pobrane dane.
8. Kliknij **Logout**, zaloguj się jako `user` / `user123`. W sekcji Admin Area zobaczysz komunikat **Access Denied**, co demonstruje poprawną weryfikację endpointu z uwzględnieniem roli użytkownika.

## Jak działa włączone PKCE?

Protokół PKCE zabezpiecza przed przechwyceniem kodu autoryzacyjnego (Authorization Code Interception Attack). Działa następująco:
1. Przeglądarka (Frontend) losuje długi ciąg znaków tzw. **`code_verifier`**. Następnie hashuje go funkcją SHA-256 tworząc **`code_challenge`**.
2. Frontend przekierowuje użytkownika na Auth Server wysyłając **`code_challenge`**. Serwer zapisuje go u siebie.
3. Po podaniu poprawnego loginu i hasła, Auth Server odsyła do przeglądarki krótki **Authorization Code**.
4. Frontend robi żądanie POST do Auth Servera z prośbą o Token, wysyłając Authorization Code ORAZ oryginalny, niezaheshowany **`code_verifier`**.
5. Auth Server sam hashuje otrzymany **`code_verifier`** funkcją SHA-256 i sprawdza czy wynik zgadza się z zapisanym w kroku 2 **`code_challenge`**.
6. Jeśli tak - serwer wie, że to ta sama aplikacja, która rozpoczęła proces (ponieważ tylko ona znała oryginalny `code_verifier`). Token jest wydawany. Atakujący, nawet jeśli przechwyciłby kod z kroku 3, nie wymieni go na token, bo nie zna oryginalnego `code_verifier`.
