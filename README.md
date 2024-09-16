# Sistema de Gestión Financiera

Web application for financial services. Using the T3 stack:

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

It's a monorepo where backend and frontend are deeply integrated, using TRPC and the backend model NextJS offers since the app directory update (version 13).

## Deployment

The application is containerized with the Dockerfile in a Github Actions CI/CD pipeline. Then it is uploaded to an ECR repository and tagged according to the pushed Tag from the repository. The image is then retrieved by an ECS service and with a Elastic Load Balancer (ELB), exposed to the internet.
