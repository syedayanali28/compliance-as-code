# Firewall-Based Connection System & IdAC Integration

## Overview
This document describes the implementation of firewall transit connections and IdAC (Infrastructure-as-Code) template integration for HKMA compliance.

## 1. Core Connection Rules

### Zones Cannot Be Connection Endpoints
- **Implementation**: `src/modules/workflow-canvas/lib/hkma-graph.ts`
- Zones now have `source: false, target: false` in `HKMA_NODE_DEFS`
- Zones are purely organizational containers
- Components must connect via firewalls

### Firewalls as Transit Points
- **Implementation**: `src/modules/workflow-canvas/lib/xyflow.ts`
- Firewalls can be both source and target (`source: true, target: true`)
- Components can connect to firewalls
- Firewalls cannot connect to other firewalls

### Firewall Transit Rule
- **Implementation**: `src/modules/workflow-canvas/lib/firewall-requests.ts`
- A valid firewall request requires: `Component A (Zone 1) → Firewall → Component B (Zone 2)`
- Source and destination MUST be in different zones
- Incomplete connections show informational messages
- Invalid connections are blocked with error messages

## 2. Connection Validation

### `validateFirewallTransit()`
Located in: `src/modules/workflow-canvas/lib/firewall-requests.ts`

**Cases Handled:**
1. **Component → Firewall** (incomplete)
   - Allows connection
   - Shows warning: "Firewall connection incomplete..."
   
2. **Firewall → Component** (completing transit)
   - Validates source component exists
   - Checks zones are different
   - Returns firewall request if valid

3. **Non-firewall connections**
   - Passes through (allows direct component connections)

**Integration:**
- Integrated into `handleConnect` in `canvas.tsx`
- Uses toast notifications for user feedback
- Tracks analytics events for completed firewall requests

## 3. IdAC Template Structure

### Excel Sheets
1. **Instructions** - Usage guidelines
2. **System Connections** - Network connection rules (21 columns)
3. **Common Services** - Shared services (DNS, NTP, etc.)
4. **Metadata** - Project information
5. **Firewall Requests** (auto-generated) - Extracted from diagram

### System Connections Columns
- Row #, Source Component, Source Technology, Source Zone, Source IP/Subnet
- Dest Component, Dest Technology, Dest Zone, Dest IP/Subnet
- Direction, Protocol, Port(s), Action
- Is Common Service?, Justification
- Environment, Application ID, Data Classification
- Encryption Required?, NAT Translation, Gateway

## 4. Export Functionality

### IdAC Export (`exportCanvasAsIdacTemplateExcel`)
**Location**: `src/modules/workflow-canvas/lib/export.ts` (lines 341-507)

**Features:**
- Generates HKMA-compliant IdAC template
- Auto-fills firewall requests from diagram
- Includes bidirectional connections
- Maps zones to standard names (Internet, DMZ, Intranet)
- Extracts metadata from nodes

**Firewall Request Extraction:**
- Pattern matching: Component → Firewall → Component
- Zone validation (must be different)
- Protocol/port extraction from custom fields
- Automatic justification generation

## 5. Import Functionality

### IdAC Import (`importIdaCExcel`)
**Location**: `src/modules/workflow-canvas/lib/idac-import.ts`

**Process:**
1. Parse Excel workbook
2. Read metadata from Metadata sheet
3. Process System Connections:
   - Create environments
   - Create zones (Internet → zone-public-network, etc.)
   - Create firewalls (from Gateway column)
   - Create source/destination components
   - Create edges: Source → Firewall → Destination
4. Return reconstructed graph

**Zone Mapping:**
- Internet → `zone-public-network`
- DMZ → `zone-dmz`
- Intranet/OA/Private Network → `zone-private-network`
- Internal → `zone-internal`

**Component Type Detection:**
- Parses technology string (e.g., "Node.js Backend" → `backend-nodejs`)
- Falls back to generic `resource-app`

## 6. Key Files Modified/Created

### Modified
1. `src/modules/workflow-canvas/lib/hkma-graph.ts`
   - Removed zone connection endpoints
   - Enabled firewall as target

2. `src/modules/workflow-canvas/lib/xyflow.ts`
   - Updated `isValidSourceTarget` validation
   - Removed zone-only firewall restriction

3. `src/modules/workflow-canvas/components/canvas.tsx`
   - Integrated `validateFirewallTransit` in `handleConnect`
   - Added toast notifications
   - Analytics tracking for firewall requests

### Created
1. `src/modules/workflow-canvas/lib/firewall-requests.ts`
   - `validateFirewallTransit()` - Connection validation
   - `extractFirewallRequests()` - Export helper
   - `FirewallRequest` & `FirewallRequestRow` interfaces

2. `src/modules/workflow-canvas/lib/idac-import.ts`
   - `importIdaCExcel()` - Excel import
   - Zone/component mapping logic
   - Graph reconstruction

3. `src/modules/workflow-canvas/lib/idac-export.ts`
   - `toIdaCExport()` - Data transformation
   - Zone name mapping
   - Component technology extraction

4. `src/modules/workflow-canvas/lib/idac-excel.ts`
   - `generateIdaCWorkbook()` - Excel generation
   - `downloadIdaCExcel()` - Download helper

5. `scripts/parse-idac-template.js`
   - Template structure analysis tool

## 7. Usage

### Creating Firewall Requests (User Workflow)
1. Add environment to canvas
2. Add zones inside environment (e.g., Public Network, DMZ, Private Network)
3. Add firewall at environment level (between zones)
4. Add components inside zones (databases, backends, etc.)
5. Connect: Component A → Firewall
6. Connect: Firewall → Component B (in different zone)
7. System validates and creates firewall request

### Exporting to IdAC
1. Complete diagram with firewall connections
2. Click "IDaC" export button in toolbar
3. Excel file downloads with:
   - All firewall requests
   - Metadata
   - Instructions
   - Empty Common Services sheet (for manual fill)

### Importing from IdAC
1. Receive IdAC Excel file
2. Use import function (to be added to UI)
3. System reconstructs diagram:
   - Environments from unique environment names
   - Zones from zone columns
   - Firewalls from Gateway column
   - Components from source/dest columns
   - Connections as Component → Firewall → Component

## 8. Validation Rules

### Enforced
- ✅ Zones cannot be connection endpoints
- ✅ Firewall connections must transit between different zones
- ✅ Components must be inside zones to use firewalls
- ✅ Firewalls cannot connect to other firewalls

### Warnings (Informational)
- ⚠️ Incomplete firewall connections (only one edge present)
- ⚠️ Missing protocol/port information

## 9. Future Enhancements

### Potential Additions
1. **Import UI** - Add import button to toolbar with file picker
2. **Common Services** - UI for managing shared services
3. **Validation Rules** - Additional HKMA-specific policy checks
4. **Bulk Operations** - Create multiple firewall requests at once
5. **Templates** - Pre-configured zone/firewall setups
6. **Diff View** - Compare diagram vs IdAC file changes

## 10. Technical Notes

### Z-Index Management
- Firewalls: `zIndex: 1001`
- Zones: `zIndex: 1001`
- Reason: Must stay above selected environment (default: 1000)

### Firewall Positioning
- Firewalls use viewport center position (not grid auto-placement)
- This allows manual positioning between zones
- Zones use grid layout for organization

### Data Flow
```
User Action (Connect A → Firewall)
  ↓
handleConnect in canvas.tsx
  ↓
validateFirewallTransit (firewall-requests.ts)
  ↓
Check existing edges for completion
  ↓
If complete: Extract firewall request
  ↓
Save to canvas
  ↓
Export: extractFirewallRequests → IdAC Excel
```

## 11. Testing Scenarios

### Valid Firewall Request
1. Public Network Zone: Frontend (Next.js)
2. Private Network Zone: Backend (Node.js), Database (PostgreSQL)
3. Firewall (External Facing): Between zones
4. Connections:
   - Frontend → Firewall → Backend
   - Backend → Firewall → Database

### Invalid Scenarios
❌ Frontend → Backend (different zones, no firewall)
❌ Frontend → Zone (zones not connectable)
❌ Firewall A → Firewall B (firewall to firewall)
❌ Frontend → Firewall → Frontend2 (same zone)

## 12. Export Format Example

### Firewall Requests Sheet
| # | Environment | Firewall | Source Component | Source Zone | Dest Component | Dest Zone | Protocol | Ports |
|---|-------------|----------|------------------|-------------|----------------|-----------|----------|-------|
| 1 | Production | External Facing Firewall | Web Frontend | Internet | API Backend | DMZ | HTTPS | 443 |
| 2 | Production | Internal Facing Firewall | API Backend | DMZ | PostgreSQL | Intranet | PostgreSQL | 5432 |

## Summary

This implementation provides a complete firewall-based connection system with HKMA IdAC compliance integration. The system enforces proper network segmentation through firewall transit points, automatically generates compliance documentation, and supports bidirectional conversion between visual diagrams and Excel templates.
