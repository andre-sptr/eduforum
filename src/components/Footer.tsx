// src/components/Footer.tsx
export default function Footer() {
  return (
    <footer className="border-t py-4 bg-muted/30">
      <div className="container mx-auto px-4 text-center">
        <p className="text-sm text-muted-foreground">
          <a
            href="https://flamyheart.site"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-primary underline-offset-4"
          >
            © {new Date().getFullYear()} Andre Saputra
          </a>
        </p>
      </div>
    </footer>
  );
}