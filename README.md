# Sistema Maika

Esta es la aplicación web de Maika. Usando el stack T3:

- [NextJS 14](https://nextjs.org/)
- [TRPC](https://trpc.io)
- [React Query](https://tanstack.com/query/v3)
- [Drizzle ORM](https://orm.drizzle.team/)
- [Lucia Auth](https://lucia-auth.com/)
- [Tailwind CSS](tailwindcss.com)
- [ShadcnUI](https://ui.shadcn.com/)
- PostgresSQL
- Redis
- DynamoDB
- AWS Lambda (para generación de PDFs)

Es un monorepo donde backend y el frontend se encuentran conectados mediante TRPC y el modelo de backend que NextJS tiene desde la versión 13. Esto permite un tipado automático entre frontend y backend.

## Despliegue
La aplicación es containerizada con el Dockerfile en un CI/CD pipeline de Github Actions, luego la imagen generada es subida a un repositorio de ECR y tageada de acuerdo al Tag del repositorio de la forma v*.*.* (ejemplo v0.4.5)
