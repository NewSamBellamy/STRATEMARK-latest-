import fs from 'fs';

const baseHtml = fs.readFileSync('C:/Users/shann/OmniVeo-HQ/01_PROJECTS/Stratemark/repo/landing-page/site/index.html', 'utf8');

// Build the 10 cards HTML
const tenCardsHtml = `          <div class="demo-deck" id="demo-deck">
            <!-- 1. OpenAI (Company / T8) -->
            <article class="gcard dpop">
              <span class="open-aff" aria-hidden="true">Open company →</span>
              <div class="gc-top">
                <span class="gc-logo"><img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAIAAAACACAMAAAD04JH5AAAAbFBMVEX///8AAADr6+vk5OTn5+czMzPg4ODa2tocHBxDQ0P7+/vx8fF6enr29vbW1tahoaHFxcWbm5u/v7+Hh4eTk5MNDQ2oqKgXFxdNTU1vb2+ysrJpaWksLCzQ0NC5ubmNjY1gYGA6OjpXV1clJSW4rMnZAAAGdElEQVR4nO1a2bKCOBAVFFQIsiOriP7/Pw5m6SSQqEHmTk0V5+nClfSh93TY7TZs2LBhw4YNGzZs+D/Cj7IUjejr/X8g3c1OloD0Evyp+C7NrQma6O/E++l1Kn5EXv2VEm5PhfgXnNufyC+4xAFlWdoM/EY8WqfuUTV6Znz7lxTSg/ALu+XVDWMgKaf9N8KDvn9eyGtHldIoz35tCjeyMDrM/pOo/eIZrirffTJTz+SfNZ5p3ddUArH1/KXsuyCxRBm6C57pXBQrLcNNLf+QMll5U4Dve+GD3V4rPAOsgMf0dg1v+4g88R9+Te3SdusQ6F6LnSaLHUF8e/OmTwRUN/k6OQG91kqlWy5i4k+xr3omaYknrsIALyV6lBc7TH7lah46rucGLtYzvw546D+O+sfIr3KlfoyQ4GSH4PoI+bd9n/ZTTewaYR8TW1qs6gc96wjaWBLvuXEop54Au6nzixf4MSibmRpy/yQrH/E/5BJA6ke9XP6+tKYEPHpZysb3MqoopxD54/6lXyz/ZlkzAja+GBLph0EidEpnoUXLMFd7ofws1xKQX597JUEKxolwHOgC9QOo+fMmKWcExN/ZvCAAhZA6HsmWy2pSQpZzkp19fkPAqyEllUkNpbkk+Sd4LPZCn3T/zphGDm8IuNxNi/Gnfg+XFbYDNo6ii/gMUueblyr1BHhBaDOa8A4IDBHayiryHUgaHbAptQSKgclCgld2oJSyJskwM5fvY5lPEj9qAl7HG+FeLsc3oHDHfxU7YxAF0AeVBLj2sSB5e+bH0v5xwd4NE38EWgJe2FoSrkjONgeRn3ke8PFzLHoUBEB8xbcFhVx3O/hPO2/lP4EUEWZYBQEKJ/K8iOcBWdXejdLMzcMQ6+/OrnQEztRHCkg/j0nOi6mfmrYEXiNaQENAaAUFn8tkVziSeLgauqGPEyg0wUoCstPZPCPJeZe8i3U1a0pszBvUqSCAZq3gEShMXIEk58aIANZA/o6A6inwjTwVteMN+J6REYgJFhMYIW4VDviO0f7gdwKvMgDAbZFRU0A8B5RmQCAXyoArP18ZECB5AHpJuoD/BQHL34UDowBv0Guf0QEX0UEmQLX6gYAttGisltBnTNwQ95IWpHA2hCi7bwiM3TwpAw7EKlaKUVtiSTbomFLHAAu+IED9jhPAOkGqh3TArzDALsfllY306p8I7HOJANZoMxsivMFFVsHYocDU5SsN7E8SAbycUSYgMxlx/xHUvxJ4GO3TO7zXOkk5NeNNoGItf10CJBXwSCKswBUeyfT31EbrEQhIO9NO+qwBKEj18MhcRE2gM3bC15qk1ZpM4oMC7JBCkOxhd6ghkBmH4QskEqwcyUrYQ+EfaKfFk6+OQDmJqS8RsU3WZA7Hd+PPJAgSaVCvJECS18xtPuIAzfdDtoMXgdCGD6z0BEg9NpbPBn0Kn9sFoWNJaENPS+AwLHKB6UFAKm8v9tL5FXLfJCJSjRdMKcLXcyXE/jDZY3LXdy6vCNMRIKWsMgxCYI6EMnAWZuJ8E36m3ZeGwB5r6rpkbM6KqM/LABsM2/z8MmOmUROg3cwCD6DOi1s5H4HBXy23H7Kr/M6rhZKAS420wAB0i0p3FBEczQxFzUcgYps1J+DuQkK8XTYnw6mwpBqWZpEEp1BKUHMCPWO68NwEq49vaYJYynnTFH2ZEWB4Lj3dJv4jBN9FmIiW0534PBMypstP13EYSN" width="36" height="36" loading="lazy" alt="" /></span>
                <div class="gc-id"><h3 class="gc-name">OpenAI</h3><span class="gc-ind">AI &amp; ML</span></div>
                <div class="gc-score">
                  <span class="gc-ring"><svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="17" fill="none" stroke="var(--border)" stroke-width="3"/><circle cx="20" cy="20" r="17" fill="none" stroke="#0E7A50" stroke-width="3" stroke-linecap="round" stroke-dasharray="101.5 106.8"/></svg><b>95</b></span>
                  <span style="color:#0E7A50">Very Strong</span>
                </div>
              </div>
              <p class="gc-one">AI research and deployment company behind ChatGPT, the API platform, and frontier models.</p>
              <p class="gc-hq"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>San Francisco, California, United States</p>
              <div class="gc-metrics"><div><p class="v num">$25B</p><p class="l">ARR</p><span class="conf conf-e">estimated</span></div><div><p class="v num">$852B</p><p class="l">Valuation</p><span class="conf conf-e">estimated</span></div><div><p class="v num">800M+</p><p class="l">Wkly users</p><span class="conf conf-e">estimated</span></div></div>
              <p class="gc-foot"><span>frontier AI labs</span><span class="tierbadge" style="color:#0A5751">T8 · The Titans</span></p>
            </article>

            <!-- 2. Anthropic (Company / T8) -->
            <article class="gcard dpop">
              <span class="open-aff" aria-hidden="true">Open company →</span>
              <div class="gc-top">
                <span class="gc-logo"><img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAIAAAACACAMAAAD04JH5AAAAY1BMVEX6+fUUFBMAAAD//////vrn5uKko6GzsrAQEA////0YFxbDwr8LDAqRkI4GBwVOTUw1NDTY19N7eni5uLVcW1ry8e11dXMcGxo9PTyYl5TPzsuJiIZWVlRoZ2YnJyYiIiFGRUSwQATqAAADDElEQVR4nO2Z23aCMBBFJQEEL6j1Sq21//+Vra6lnBMzUCDxafZbwTKTyc6FMJkoiqIoiqIoiqIoiqL0ISWkGxETqHOk9N+o97HCp1NDZM875QmvT2PVwJ4WCWCWzxKkW9NcX6xtnPjpxmD8pDBNIGsKyGwTpwTlmRNIzPYZqFzCPfNRtj1neALYyhvVqilBBgkUJkr8PwUTB9DQriq4HkVDR8G3a+gq6Go4ia3hi4KuhufIGr4o6GhIFSpM8ApQH/s1XIMj4TUkyyFQ/QxEo6T6Ca1h5i1AUiSShpn8rCHQTEclmDcafqCGy7Aapti6Clu6kzQM2gfpHBt3XvtrzRpuQ2pov3Ci3eSYjqThKmQJaKmZWfrzHRryYpundod/v0FDUtDsHSUujYafcTTkeDftrZPRA/sdRUNW8FZx7hPQMI+i4f51mSENj6hhcz2Yhmn9qhbtTsxno+GBShNGQ+sZXDTkzaHZGEXQkBRcnB7PpKwg2yNen4fQ0F6wsY91nod87tcQFooR7MmrRySudUwNuUnNXo9rLWo4vg9s5d/tcmKShsnoPiAFiys8j7sGMg6rISuYw+N4RQIN66Aacjvx6IGH57cV/mWkhtzTF2oOT1CNhlyakRraq9yh0is5a3McNR2z0jPL8CIFWSf+0gyABnVyPc4IrA6+C7GGh1ElcA5lHPAevpJnwgjtDSnYBUxS0gjtDW30OxMQNRw8FfjOJGQiaEhL7j9KEF7DXvHDa9hLwXsg0JAOzQZq2EvBe6Cz/9BsoIb9FLwHMk1nSwtFD1hBI4I/ks5uB2mY0qPr7dTLFidr6ex2kIa08//b4ad+ykxY/Uef3fK7j/yqzYHCnd2ygi37GvY93CcEOnltf8+lQME+IdDJbGsX0mgJ9gnBUbAtfbGzRmnICrbXj49FQMPpcA2dVrUbRGsGapgO15AU7E5emg2Hf0JgBbsWsxLfnqqvAJ8Q+ONAp8C0AwvyCaFc42qz66ydpdXpjGe3wLpHH2RI399n0o3/x1cURVEURVEURVEURXknvxgRJ5s17RDOAAAAAElFTkSuQmCC" width="36" height="36" loading="lazy" alt="" /></span>
                <div class="gc-id"><h3 class="gc-name">Anthropic</h3><span class="gc-ind">AI &amp; ML</span></div>
                <div class="gc-score">
                  <span class="gc-ring"><svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="17" fill="none" stroke="var(--border)" stroke-width="3"/><circle cx="20" cy="20" r="17" fill="none" stroke="#0E7A50" stroke-width="3" stroke-linecap="round" stroke-dasharray="101.5 106.8"/></svg><b>95</b></span>
                  <span style="color:#0E7A50">Very Strong</span>
                </div>
              </div>
              <p class="gc-one">AI safety and research company building Claude — widely adopted for enterprise coding and workflows.</p>
              <p class="gc-hq"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>San Francisco, California, United States</p>
              <div class="gc-metrics"><div><p class="v num">$47B</p><p class="l">ARR</p><span class="conf conf-e">estimated</span></div><div><p class="v num">$965B</p><p class="l">Valuation</p><span class="conf conf-v">verified</span></div><div><p class="v num">~5K</p><p class="l">Team</p><span class="conf conf-e">estimated</span></div></div>
              <p class="gc-foot"><span>frontier AI labs</span><span class="tierbadge" style="color:#0A5751">T8 · The Titans</span></p>
            </article>

            <!-- 3. NVIDIA (Infrastructure / T8) -->
            <article class="gcard dpop">
              <span class="open-aff" aria-hidden="true">Open company →</span>
              <div class="gc-top">
                <span class="gc-logo"><img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADAAAAAwCAYAAABXAvmHAAAGDklEQVRoge3Ya4xdVRUH8N/qTDEtaCUVwyMBWiiaippiRQHRKG1zj1TCI6BINPHRYqwhNdwL2mhFYwzhHt6maqBEI/gBEyOGeK+x2migRiMQlaTRIhBTKZJqUXmpbZcfzrkzZ6YzzvQVo5l/cpN991577fXaa62zmcEMZjCDGczgfxhxKJi0e27C0YeC1zSxtSzcAMOHiOFlEU4Y/MmUEZVx9me8H7SbqRSYdYgU+K/hUHlAppzs//6Mp0k7ggNSoNM3J9NpEZZgYaYbI+zCXBybaWGEM+q1Iw5DCO2/Au2eOViG92Z6Vy3oAAu7LU+Oow+chPMzfQBLMetQe2DKLNTueVWEVVid6aSGJV6K8CSeyPSDCP/CLjyeaWtZ+NuAR6dvFt6WaV2E5QNFDuYSd1vO4z94oN1zZISrMn0Sx9TTL+B7+DYexM5uy552z3ZGslDi2U7fT3BXpu93W/bgp+2eB3A+bsGCqYw3HUzogXbPyvqQhfXUi9iAm8vCUxPQb8fxk5zxCNplYXOD/hW4DR88QLk3l0XlgTEKdPrm14JfkUkEmTZHuLLb8liDLjKdGOEdWJLp0QjP4Ei8NtPyCGdiuHZ54iuZrikLLzT4rMatmV52oCE0okC755wI38ApNeHuCDdk+lxZ2F3TzI5wMdZkOiuiCsFMC8pi7CXu9L0RX8i0MqKqN5m2RLik2/J0g+7dmb4VYd4BKVBni1W4SZUGYQ8+URa+1lDw3No7Sxo02/CHen5L8+LWewIfqdcHvLdiRVn4Y4NuGb6Do0wPIyE0K8IXI2zA3AgRQYRrBsK3e4Y7fddF+CGW1OubcHaE15eFFu6M8Fin77Od/mhiKAtZFu6McGmElyDC4gj31/dgQLcpwoewt5YhatrJxiMYxhkYYiTPbsPtDW1LXKUKt8T1WD8IqwaOwecxH2vHrS0wtm2Za98E8joH0NrMynRzs4hkOiXT4gbNS5kjhWR3phu7rX2EH+yVaU27p4B2z1C756ZMt2c6oqbbmenCsvDXwd52z9pM6xt8corxqAIRNkV4gBE3DUVoN2S7I8KLtfuG66K2DwYuri/2LZ2+EyJ8F2sjzKr3PxvhgrKwlSqbdfquRhlhqMlnivGoAt2WvfgUY6x6ebvndCgLv8fGxtrVnb5jJ1KigUX4DVY25v6E87stP6O6W/iSqi1uhs5W3Ie9U5xRKQDdli3YOHBTpiHc3O6NpL/rMj1ej+dn+mq7Z3aTUWPvwM2vbIx/nemdZTEi/Dzck+nazNH0iB9lenumi/CeTA9PGUINGdZF+F3DVedF+DiUhb9EuALP1esXYEOnb85gcyOEmi7fjQ0Rzm2EzZvqkL20Qb83wq1YWRZ21tmrF+GsCKuxY7IQGl+J34wf46i6YLyQaUVZ2FJbbkWEexkpOr/AukzfjBhtJTI9H+F+dLstD9W852ZqR7gWcxvF6c+Z1kS4t9sa+00xQLvn5AgP4+hJK3FDictq9w7V5f3pCMu7LY/W66ermrSlA+tlWhbhaMzBjkyPlIVd9eHDEd6H9ZlOHVdRN+HKbssTEwlen7c008YIb2jsm1yB+tBVquZtqJ56Bhc3PDGEy3AlzsTiZitR34/TcBE+jJPHHfEUPo27y2JSqx+Hz6i6hPFd88TN3DgGl0e4I7Oq0Hgx0/oIt3Vb/tmw0PxM90T4hyqTzc+0KMJxjGnQMtNTEb6MDd3W2Lajwe8kVa+1OsI8ptnMTcLsrZm+HuE1jc2/wvWZ7i8Lz9fKbo/JXyX+HuFB3J3pvrLw3ATGOiLCOZk+GuFCY+/IgStQM5+H9fgYo1kHT2Mzfo7leLUqdz+HHfgtHsIvy8LOCfgOqxrDi3AJTp2OPDWmDqHx6PQ" width="36" height="36" loading="lazy" alt="" /></span>
                <div class="gc-id"><h3 class="gc-name">NVIDIA</h3><span class="gc-ind">Semiconductors</span></div>
                <div class="gc-score">
                  <span class="gc-ring"><svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="17" fill="none" stroke="var(--border)" stroke-width="3"/><circle cx="20" cy="20" r="17" fill="none" stroke="#0E7A50" stroke-width="3" stroke-linecap="round" stroke-dasharray="101.5 106.8"/></svg><b>95</b></span>
                  <span style="color:#0E7A50">Very Strong</span>
                </div>
              </div>
              <p class="gc-one">Designs GPUs and full-stack accelerated computing platforms that power most frontier AI training and inference.</p>
              <p class="gc-hq"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>Santa Clara, California, United States</p>
              <div class="gc-metrics"><div><p class="v num">$216B</p><p class="l">FY rev</p><span class="conf conf-v">verified</span></div><div><p class="v num">$4.9T</p><p class="l">Mkt cap</p><span class="conf conf-e">estimated</span></div><div><p class="v num">~85%</p><p class="l">GPU share</p><span class="conf conf-e">estimated</span></div></div>
              <p class="gc-foot"><span>compute infrastructure</span><span class="tierbadge" style="color:#0A5751">T8 · The Titans</span></p>
            </article>

            <!-- 4. Microsoft (Distribution / T8) -->
            <article class="gcard dpop">
              <span class="open-aff" aria-hidden="true">Open company →</span>
              <div class="gc-top">
                <span class="gc-logo"><svg width="32" height="32" viewBox="0 0 24 24" fill="none"><rect x="1" y="1" width="10" height="10" fill="#F25022"/><rect x="13" y="1" width="10" height="10" fill="#7FBA00"/><rect x="1" y="13" width="10" height="10" fill="#00A4EF"/><rect x="13" y="13" width="10" height="10" fill="#FFB900"/></svg></span>
                <div class="gc-id"><h3 class="gc-name">Microsoft</h3><span class="gc-ind">Cloud &amp; OS</span></div>
                <div class="gc-score">
                  <span class="gc-ring"><svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="17" fill="none" stroke="var(--border)" stroke-width="3"/><circle cx="20" cy="20" r="17" fill="none" stroke="#0E7A50" stroke-width="3" stroke-linecap="round" stroke-dasharray="101.5 106.8"/></svg><b>95</b></span>
                  <span style="color:#0E7A50">Very Strong</span>
                </div>
              </div>
              <p class="gc-one">Azure cloud infrastructure provider and enterprise distribution giant scaling Copilot and OpenAI models globally.</p>
              <p class="gc-hq"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>Redmond, Washington, United States</p>
              <div class="gc-metrics"><div><p class="v num">$245B</p><p class="l">FY rev</p><span class="conf conf-v">verified</span></div><div><p class="v num">$3.4T</p><p class="l">Mkt cap</p><span class="conf conf-v">verified</span></div><div><p class="v num">400M+</p><p class="l">M365 seats</p><span class="conf conf-v">verified</span></div></div>
              <p class="gc-foot"><span>enterprise distribution</span><span class="tierbadge" style="color:#0A5751">T8 · The Titans</span></p>
            </article>

            <!-- 5. CoreWeave (Infrastructure / T6) -->
            <article class="gcard dpop">
              <span class="open-aff" aria-hidden="true">Open company →</span>
              <div class="gc-top">
                <span class="gc-logo"><svg width="32" height="32" viewBox="0 0 24 24" fill="#087F6A"><path d="M12 2L2 7v10l10 5 10-5V7L12 2zm0 2.8L19.2 8 12 11.6 4.8 8 12 4.8zM4 9.8l7 3.5v7.4l-7-3.5V9.8zm9 10.9v-7.4l7-3.5v7.4l-7 3.5z"/></svg></span>
                <div class="gc-id"><h3 class="gc-name">CoreWeave</h3><span class="gc-ind">Cloud Compute</span></div>
                <div class="gc-score">
                  <span class="gc-ring"><svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="17" fill="none" stroke="var(--border)" stroke-width="3"/><circle cx="20" cy="20" r="17" fill="none" stroke="#0E7A50" stroke-width="3" stroke-linecap="round" stroke-dasharray="88 106.8"/></svg><b>82</b></span>
                  <span style="color:#0E7A50">Strong</span>
                </div>
              </div>
              <p class="gc-one">Specialized GPU cloud provider offering purpose-built infrastructure for massive frontier AI training clusters.</p>
              <p class="gc-hq"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>Roseland, New Jersey, United States</p>
              <div class="gc-metrics"><div><p class="v num">$2.3B</p><p class="l">ARR</p><span class="conf conf-e">estimated</span></div><div><p class="v num">$23B</p><p class="l">Valuation</p><span class="conf conf-v">verified</span></div><div><p class="v num">32</p><p class="l">Data centers</p><span class="conf conf-v">verified</span></div></div>
              <p class="gc-foot"><span>compute infrastructure</span><span class="tierbadge" style="color:#0A5751">T6 · Scale Stage</span></p>
            </article>

            <!-- 6. Mistral AI (Company / T6) -->
            <article class="gcard dpop">
              <span class="open-aff" aria-hidden="true">Open company →</span>
              <div class="gc-top">
                <span class="gc-logo"><img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAIAAAACACAMAAAD04JH5AAAAP1BMVEVHcEzYAwzhBAD/ggTgAgH/rwH0RwvJARnEAB36Tg//kgP/ggT/rwH7UA/EAB3EggD7UA/EAB3/ggThBAD/rwG3lVRdAAAAD3RSTlMAuOjl/u4GJPH7LaSkpPlyMDE/AAABCElEQVR4nO2W0Q6CMAxFYeIQVKLi/3+r8c3dJjaVGTGc82bWNmc3Da5pAAAAAABgpeyV6IDxLgNOQYF7yQcCAgIIIIAAAghsTiAvFNjdhJ2gDaMW6IBjTEDbDUbAawgKmAs4Arm2AAmQAAmQAAmQwB8kkEtqCwyX4T0Xg1N/jgrUBgEEEEAAAQQQCAqkuXtlTvoAmaWgLQuavjx/FgQFSpKcZzk383s5734tEEwgVxdIm0+AHWAHvr4DWrC6BNgBvgPeDvRCKv/Nu2QKhFYLzHtAC8oLXT0m+W1u4A6QCZKIK6DjwgJKZYGMAAIIIIAAAksFDlGsQKx/Cj7RPHKuOw8AAAAAYEM8AAIAYtG4JCuPAAAAAElFTkSuQmCC" width="36" height="36" loading="lazy" alt="" /></span>
                <div class="gc-id"><h3 class="gc-name">Mistral AI</h3><span class="gc-ind">AI &amp; ML</span></div>
                <div class="gc-score">
                  <span class="gc-ring"><svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="17" fill="none" stroke="var(--border)" stroke-width="3"/><circle cx="20" cy="20" r="17" fill="none" stroke="#D99A25" stroke-width="3" stroke-linecap="round" stroke-dasharray="75 106.8"/></svg><b>70</b></span>
                  <span style="color:#D99A25">Established</span>
                </div>
              </div>
              <p class="gc-one">European AI champion building efficient open-weights models and commercial enterprise deployment engines.</p>
              <p class="gc-hq"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>Paris, Île-de-France, France</p>
              <div class="gc-metrics"><div><p class="v num">€60M</p><p class="l">ARR</p><span class="conf conf-e">estimated</span></div><div><p class="v num">$6.2B</p><p class="l">Valuation</p><span class="conf conf-v">verified</span></div><div><p class="v num">150+</p><p class="l">Team</p><span class="conf conf-e">estimated</span></div></div>
              <p class="gc-foot"><span>frontier AI labs</span><span class="tierbadge" style="color:#0A5751">T6 · Scale Stage</span></p>
            </article>

            <!-- 7. Scale AI (Infrastructure / T6) -->
            <article class="gcard dpop">
              <span class="open-aff" aria-hidden="true">Open company →</span>
              <div class="gc-top">
                <span class="gc-logo"><svg width="32" height="32" viewBox="0 0 24 24" fill="#087F6A"><circle cx="12" cy="12" r="10"/><path d="M8 12l2.5 2.5L16 9" stroke="#fff" stroke-width="2" stroke-linecap="round"/></svg></span>
                <div class="gc-id"><h3 class="gc-name">Scale AI</h3><span class="gc-ind">Data Engine</span></div>
                <div class="gc-score">
                  <span class="gc-ring"><svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="17" fill="none" stroke="var(--border)" stroke-width="3"/><circle cx="20" cy="20" r="17" fill="none" stroke="#0E7A50" stroke-width="3" stroke-linecap="round" stroke-dasharray="86 106.8"/></svg><b>81</b></span>
                  <span style="color:#0E7A50">Strong</span>
                </div>
              </div>
              <p class="gc-one">Data engine powering RLHF, frontier model evaluation, and mission-critical training datasets for top labs.</p>
              <p class="gc-hq"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>San Francisco, California, United States</p>
              <div class="gc-metrics"><div><p class="v num">$870M</p><p class="l">ARR</p><span class="conf conf-e">estimated</span></div><div><p class="v num">$13.8B</p><p class="l">Valuation</p><span class="conf conf-v">verified</span></div><div><p class="v num">1,200</p><p class="l">Team</p><span class="conf conf-e">estimated</span></div></div>
              <p class="gc-foot"><span>data infrastructure</span><span class="tierbadge" style="color:#0A5751">T6 · Scale Stage</span></p>
            </article>

            <!-- 8. Groq (Infrastructure / T5) -->
            <article class="gcard dpop">
              <span class="open-aff" aria-hidden="true">Open company →</span>
              <div class="gc-top">
                <span class="gc-logo"><svg width="32" height="32" viewBox="0 0 24 24" fill="#087F6A"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg></span>
                <div class="gc-id"><h3 class="gc-name">Groq</h3><span class="gc-ind">LPU Silicon</span></div>
                <div class="gc-score">
                  <span class="gc-ring"><svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="17" fill="none" stroke="var(--border)" stroke-width="3"/><circle cx="20" cy="20" r="17" fill="none" stroke="#0E7A50" stroke-width="3" stroke-linecap="round" stroke-dasharray="80 106.8"/></svg><b>75</b></span>
                  <span style="color:#0E7A50">Strong</span>
                </div>
              </div>
              <p class="gc-one">Creator of the LPU (Language Processing Unit), delivering ultra-low-latency real-time inference for frontier LLMs.</p>
              <p class="gc-hq"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>Mountain View, California, United States</p>
              <div class="gc-metrics"><div><p class="v num">500 t/s</p><p class="l">LPU Speed</p><span class="conf conf-v">verified</span></div><div><p class="v num">$2.8B</p><p class="l">Valuation</p><span class="conf conf-v">verified</span></div><div><p class="v num">300K+</p><p class="l">Devs</p><span class="conf conf-e">estimated</span></div></div>
              <p class="gc-foot"><span>inference silicon</span><span class="tierbadge" style="color:#0A5751">T5 · Product-Market Fit</span></p>
            </article>

            <!-- 9. Together AI (Infrastructure / T5) -->
            <article class="gcard dpop">
              <span class="open-aff" aria-hidden="true">Open company →</span>
              <div class="gc-top">
                <span class="gc-logo"><svg width="32" height="32" viewBox="0 0 24 24" fill="#087F6A"><circle cx="7" cy="12" r="5"/><circle cx="17" cy="12" r="5"/></svg></span>
                <div class="gc-id"><h3 class="gc-name">Together AI</h3><span class="gc-ind">Inference Cloud</span></div>
                <div class="gc-score">
                  <span class="gc-ring"><svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="17" fill="none" stroke="var(--border)" stroke-width="3"/><circle cx="20" cy="20" r="17" fill="none" stroke="#0E7A50" stroke-width="3" stroke-linecap="round" stroke-dasharray="78 106.8"/></svg><b>73</b></span>
                  <span style="color:#0E7A50">Strong</span>
                </div>
              </div>
              <p class="gc-one">Cloud platform for fine-tuning and running open-source frontier models with industry-leading token economics.</p>
              <p class="gc-hq"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>San Francisco, California, United States</p>
              <div class="gc-metrics"><div><p class="v num">$120M</p><p class="l">ARR</p><span class="conf conf-e">estimated</span></div><div><p class="v num">$1.25B</p><p class="l">Valuation</p><span class="conf conf-v">verified</span></div><div><p class="v num">200K+</p><p class="l">Devs</p><span class="conf conf-e">estimated</span></div></div>
              <p class="gc-foot"><span>cloud inference</span><span class="tierbadge" style="color:#0A5751">T5 · Product-Market Fit</span></p>
            </article>

            <!-- 10. Crusoe (Infrastructure / T5) -->
            <article class="gcard dpop">
              <span class="open-aff" aria-hidden="true">Open company →</span>
              <div class="gc-top">
                <span class="gc-logo"><svg width="32" height="32" viewBox="0 0 24 24" fill="#087F6A"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg></span>
                <div class="gc-id"><h3 class="gc-name">Crusoe</h3><span class="gc-ind">Clean Compute</span></div>
                <div class="gc-score">
                  <span class="gc-ring"><svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="17" fill="none" stroke="var(--border)" stroke-width="3"/><circle cx="20" cy="20" r="17" fill="none" stroke="#0E7A50" stroke-width="3" stroke-linecap="round" stroke-dasharray="77 106.8"/></svg><b>72</b></span>
                  <span style="color:#0E7A50">Strong</span>
                </div>
              </div>
              <p class="gc-one">Pioneering climate-aligned computing by colocating high-density GPU data centers with stranded clean energy.</p>
              <p class="gc-hq"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>Denver, Colorado, United States</p>
              <div class="gc-metrics"><div><p class="v num">$450M</p><p class="l">ARR</p><span class="conf conf-e">estimated</span></div><div><p class="v num">$3.0B</p><p class="l">Valuation</p><span class="conf conf-v">verified</span></div><div><p class="v num">300+</p><p class="l">Team</p><span class="conf conf-e">estimated</span></div></div>
              <p class="gc-foot"><span>datacenter infrastructure</span><span class="tierbadge" style="color:#0A5751">T5 · Product-Market Fit</span></p>
            </article>
          </div>`;

// Replace 3 cards with 10 cards in index-enhanced.html
const enhancedHtml = baseHtml.replace(/<div class="demo-deck" id="demo-deck">[\s\S]*?<\/div>\s*<\/div>\s*<div class="demo-foot">/m, tenCardsHtml + '\n        </div>\n        <div class="demo-foot">');

fs.writeFileSync('C:/Users/shann/OmniVeo-HQ/01_PROJECTS/Stratemark/repo/landing-page/site/index-enhanced.html', enhancedHtml, 'utf8');
console.log('Successfully wrote index-enhanced.html with 10 Frontier AI companies across 7 facets and 8 tiers!');
