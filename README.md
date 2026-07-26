# Internship Management System (IMS)

A complete, functional, and premium IMS built with Vanilla JS, HTML5, and CSS3. This system automates company verification and student On-Duty (OD) approval workflows with an emphasis on Object-Oriented Programming (OOP) design patterns.

## 🚀 Getting Started
1. Open `index.html` in any modern browser.
2. Select a role (e.g., Student, Internship Coordinator, Mentor) to log in.
3. Explore the role-specific dashboards and workflows.

## 🏗️ Technical Architecture & Design Patterns

### 1. State Pattern 
The system manages status transitions for both Companies and OD applications.
- **Implementation**: `WorkflowState` class in `app.js`.
- **Logic**: Objects maintain a status history and transition only through logically valid states (e.g., `Pending_HOD` can only move to `Pending_TPO` or `Rejected`).

### 2. Observer Pattern
Real-time notification updates when status changes occur.
- **Implementation**: `GlobalNotifier` (Subject) and role-specific listeners.
- **Logic**: Subscribers receive updates whenever a transition occurs in the shared state, triggering toasts and badge updates globally.

### 3. Abstract Approval & Polymorphism
Uniform approval logic with persona-driven behavior.
- **Implementation**: `BaseApprover` abstract class with Mentor, HOD, and TPO specific overrides.
- **Logic**: The system uses a Chain-of-Responsibility-like polymorphism to forward applications from one level to the next without the client needing to know the specific handler's role.

### 4. Encapsulation
Secure handling of institutional data.
- **Implementation**: Private variables within the `Store` IIFE.
- **Logic**: Access to companies, ODs, and notifications is mediated through specific methods, preventing unauthorized direct mutation of the global state.

## 🚀 Key Pipelines
- **Company Onboarding**: Self-registration → Internship Coordinator Review → Verification.
- **Student OD Pipeline**: Application → Mentor Review → HOD Review → TPO Review → Result.
- **UML Maps**: Embedded state diagrams visualize the institutional logic directly in the UI.

## 🎨 UI/UX Features
- **Premium Academic Aesthetic**: Deep navy and gold color palette.
- **Dynamic Workflows**: Visual UML-inspired progress bars show real-time application status.
- **Responsive Design**: Works on mobile and desktop.
- **Dark/Light Mode**: Persistence-ready theme switching.
- **State Badges**: Clearly visible status indicators throughout the UI.

---
*Built for excellence in academic administration.*
