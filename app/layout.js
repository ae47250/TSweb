import "./styles/globals.css";

export const metadata = {
  title: "Alpha Tree Service Estimate Builder",
  description: "Tree service estimate workflow for Alpha Tree Service",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
