import type { Service } from '../../../domain'
import { ServiceCard } from './ServiceCard'

interface Props {
  services: readonly Service[]
}

export function ServiceGrid({ services }: Props) {
  return (
    <section id="services" className="px-6 py-24 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold text-white sm:text-4xl">Microservices</h2>
          <p className="mt-4 text-gray-400 max-w-xl mx-auto">
            Each service is independent with its own database, auth mechanism, and MCP endpoint.
            Connect them individually or orchestrate through the platform gateway.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {services.map((service) => (
            <ServiceCard key={service.id} service={service} />
          ))}
        </div>
      </div>
    </section>
  )
}
