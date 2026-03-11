# 📚 OpenNotes.in

OpenNotes.in is a community-driven platform designed for students and educators to exchange study materials, notes, and academic resources. Built with a modern tech stack, it provides a seamless experience for buying, selling, and discovering high-quality academic content.

<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

---

## ✨ Features

- **Secure Authentication**: User registration and login with JWT-based sessions.
- **Note Marketplace**: Browse and search through various academic notes and resources.
- **Buying Flow**: Integrated cart system, secure checkout, and order management.
- **Selling Platform**: Easily upload notes, manage your listings, and track sales.
- **Real-time Messaging**: Communicate directly with sellers after making a purchase to coordinate or ask questions.
- **User Reviews**: Rate and review materials to build trust within the community.
- **Responsive Design**: Polished UI with glassmorphism and smooth animations, optimized for all devices.

---

## 🛠️ Tech Stack

### Frontend
- **React 19** & **Vite**
- **Tailwind CSS 4** for styling
- **Framer Motion** for animations
- **Lucide React** for iconography
- **Socket.io-client** for real-time updates

### Backend
- **Node.js** & **Express**
- **LibSQL (SQLite)** for database management
- **JWT & Bcryptjs** for security
- **Multer** for file handling and image uploads
- **Nodemailer** for email notifications

---

## 📂 File Structure

```text
bits-notes-exchange/
├── server/                 # Backend (Node.js/Express)
│   ├── src/
│   │   ├── controllers/    # Request handlers
│   │   ├── db/             # Database schema and initialization
│   │   ├── routes/         # API endpoints (auth, listings, orders, etc.)
│   │   ├── utils/          # Helper functions (email, auth guards)
│   │   ├── env.ts          # Environment configuration
│   │   └── index.ts        # Server entry point
│   ├── data.db             # LibSQL database file
│   └── package.json
├── src/                    # Frontend (React)
│   ├── components/         # Reusable UI components (Navbar, Footer, Modals)
│   ├── contexts/           # State management (Auth, Cart)
│   ├── types/              # Type definitions
│   ├── views/              # Page views (Home, Browse, Sell, Checkout)
│   ├── App.tsx             # Main routing and app structure
│   └── main.tsx            # React entry point
├── public/                 # Static assets
├── uploads/                # Storage for note images
├── package.json            # Root dependencies and scripts
└── vite.config.ts          # Vite configuration
```

---

## 🔄 Application Workflow

1.  **Onboarding**: Users sign up and log in to access the marketplace features.
2.  **Discovery**: Browse categories or search for specific study materials in the **Browse View**.
3.  **Procurement**: Add selected notes to the **Cart** and proceed to a secure **Checkout**.
4.  **Ownership**: Purchased notes appear in the **My Orders** section, where users can also access seller contact info.
5.  **Engagement**: Use the integrated **Messaging System** to talk to sellers or leave reviews for items purchased.
6.  **Contribution**: Users can switch to the **Sell View** to upload their own notes, setting descriptions and prices.

---

## 🚀 Getting Started

### Prerequisites
- Node.js (v18+)
- npm

### 1. Setup the Backend
```bash
cd server
npm install
# Initialize the database
npm run server:init-db
```
Create a `.env` file in the `server` directory and add your configurations (refer to `.env.example`).

### 2. Setup the Frontend
```bash
# From the root directory
npm install
```

### 3. Run Locally
You can run both the frontend and backend concurrently:
```bash
npm run dev:all
```
- Frontend: `http://localhost:3000`
- API Backend: `http://localhost:5000`

---

## 📄 License

This project is licensed under the MIT License.
