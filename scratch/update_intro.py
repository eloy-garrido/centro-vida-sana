with open('scratch/organic_pointillism.svg', 'r', encoding='utf-8') as f:
    svg_body = f.read().strip()

content = f"""---
// IntroContent.astro - Sección de Introducción con transición de puntillismo
---

<section class="intro-content pt-16 sm:pt-20 bg-[#007231] text-white relative z-10" id="introduccion">
  <div class="max-w-5xl mx-auto px-4 sm:px-6 text-center space-y-6 pb-12 sm:pb-16">
    <h2 class="font-serif text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight text-white">
      <span class="text-[#c9f26e]">Acupuntura, Quiropraxia y Kinesiología</span> en <span class="text-[#c9f26e]">Temuco</span> — Centro Vida Sana Austral
    </h2>
    <p class="text-base sm:text-lg text-white/95 leading-relaxed font-normal max-w-4xl mx-auto">
      Centro Vida Sana Austral es un centro de terapias integrales de salud en Temuco, La Araucanía, especializado en <strong class="text-[#c9f26e] font-bold">acupuntura</strong>, <strong class="text-[#c9f26e] font-bold">quiropraxia</strong> y <strong class="text-[#c9f26e] font-bold">kinesiología</strong> con <strong class="text-[#c9f26e] font-bold">profesionales certificados por Minsal</strong>. Tratamos dolor lumbar y cervical, lesiones deportivas, problemas posturales y procesos de rehabilitación corporal con un enfoque personalizado y natural.
    </p>
    <p class="text-base sm:text-lg text-white/95 leading-relaxed font-normal max-w-4xl mx-auto">
      Ubicados en <strong class="text-[#c9f26e] font-bold">Los Armiños 1620, Temuco</strong>, contamos con <strong class="text-[#c9f26e] font-bold">Felipe Méndez</strong>, especialista en quiropraxia y kinesiología —incluida kinesiología a domicilio en Temuco y La Araucanía—, y <strong class="text-[#c9f26e] font-bold">Eduardo Lagos</strong>, acupunturista certificado en medicina tradicional china. Ofrecemos consultas de acupuntura, ajustes quiroprácticos, electroacupuntura, masoterapia y fisioterapia. ¡Agenda tu consulta de salud integral hoy!
    </p>
  </div>

  <!-- Transición de Difuminado con Puntillismo hacia la sección de Profesionales -->
  <div class="w-full overflow-hidden leading-none relative z-10 bg-[#FBFDFB]">
    {svg_body}
  </div>
</section>

<style>
  .intro-content {{
    background: #007231;
    position: relative;
    z-index: 10;
  }}
</style>
"""

with open('src/components/home/IntroContent.astro', 'w', encoding='utf-8') as f:
    f.write(content)

print("Updated IntroContent.astro successfully")
