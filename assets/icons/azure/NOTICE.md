# Azure icons — notice

The PNG files in this folder are converted from **Microsoft Azure Architecture Icons, V25**.
They belong to Microsoft. They are **not** covered by this repository's MIT licence (`LICENSE`).

| | |
|---|---|
| Source page | https://learn.microsoft.com/azure/architecture/icons/ |
| Download | https://arch-center.azureedge.net/icons/Azure_Public_Service_Icons_V25.zip |
| Version | V25 |
| Converted by | `scripts/build-azure-icons.cjs` (128 px, transparent background); the list of icons and their source files is `manifest.json` |
| Used by | `scripts/architecture-diagram.py` (`/arch-diagram`), inside the architecture diagrams it draws |

## Microsoft's terms

Quoted from `Microsoft_Terms_of_Use.pdf` in the V25 download:

> Microsoft permits the use of these icons in architectural diagrams, training materials, or
> documentation. You may copy, distribute, and display the icons only for the permitted use
> unless granted explicit permission by Microsoft. Microsoft reserves all other rights.

**Do's**
- Use the icons to illustrate how products can work together.
- In diagrams, include the product name somewhere close to the icon.
- Use the icons as they would appear within Azure.

**Don'ts**
- Don't crop, flip or rotate icons.
- Don't distort or change icon shape in any way.
- Don't use Microsoft product icons to represent your product or service.

## What this means for diagram specs

- `/arch-diagram` gives a type an Azure icon by default only when the type is an Azure service
  (for example `key-vault` or `event-hubs`). Generic types such as `vm`, `firewall` or
  `sql-server` have no icon by default, because the component may not be in Azure.
- Use a spec's `icon:` key only for a component that really is that Azure service. Do not put an
  Azure icon on an on-prem server, a non-Microsoft product or your own application.
- Keep the component name in the box next to the icon. The renderer always does this.
- Do not edit, recolour or crop the PNGs. To update them, re-run the build script on a newer
  download.

ADO-82.
