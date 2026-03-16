-- ============================================================
-- Seed: Common Services
-- ============================================================
insert into public.common_services (name, protocol, port, source_zone, dest_zone, description, provided_by) values
  ('SMTP Relay',        'TCP', '25',   'Intranet', 'DMZ',      'Outbound email relay through DMZ SMTP gateway',         'Email Services Team'),
  ('SMTP Submission',   'TCP', '587',  'Intranet', 'DMZ',      'Authenticated email submission (STARTTLS)',              'Email Services Team'),
  ('HTTPS Outbound',    'TCP', '443',  'Intranet', 'DMZ',      'Outbound HTTPS via forward proxy in DMZ',               'Network Services Team'),
  ('HTTP Outbound',     'TCP', '80',   'Intranet', 'DMZ',      'Outbound HTTP via forward proxy in DMZ (discouraged)',   'Network Services Team'),
  ('DNS Resolution',    'UDP', '53',   'Intranet', 'Intranet', 'Internal DNS resolution',                               'Network Services Team'),
  ('DNS Resolution',    'TCP', '53',   'Intranet', 'Intranet', 'Internal DNS resolution (TCP fallback)',                 'Network Services Team'),
  ('NTP Sync',          'UDP', '123',  'Intranet', 'Intranet', 'Time synchronization to internal NTP servers',           'Network Services Team'),
  ('LDAP Auth',         'TCP', '389',  'Intranet', 'Intranet', 'LDAP authentication to Active Directory',               'Identity & Access Team'),
  ('LDAPS Auth',        'TCP', '636',  'Intranet', 'Intranet', 'Secure LDAP authentication (TLS)',                       'Identity & Access Team'),
  ('Kerberos Auth',     'TCP', '88',   'Intranet', 'Intranet', 'Kerberos authentication to AD domain controller',        'Identity & Access Team'),
  ('Syslog',            'UDP', '514',  'Intranet', 'Intranet', 'Centralized syslog collection',                         'Security Operations Team'),
  ('Syslog TLS',        'TCP', '6514', 'Intranet', 'Intranet', 'Encrypted syslog forwarding',                           'Security Operations Team'),
  ('SNMP Monitoring',   'UDP', '161',  'Intranet', 'Intranet', 'Network device monitoring via SNMP',                    'Network Services Team'),
  ('HTTPS Inbound',     'TCP', '443',  'DMZ',      'DMZ',      'Inbound HTTPS termination at reverse proxy/LB in DMZ',  'Network Services Team'),
  ('Reverse Proxy',     'TCP', '443',  'DMZ',      'Intranet', 'DMZ reverse proxy forwarding to backend services',       'Network Services Team'),
  ('SSH Bastion',       'TCP', '22',   'Intranet', 'Intranet', 'SSH access via bastion host (controlled)',               'Security Operations Team');

-- ============================================================
-- Seed: Guidelines (initial set from existing cautions catalog)
-- ============================================================
insert into public.guidelines (caution_id, title, description, category, severity, required_action, context, example_violation, check_logic) values
  ('C-IN-01',   'Incoming Internet Access',
    'Firewall rules allowing direct inbound access from the Internet to any internal zone must be flagged as high risk. All Internet-facing services must go through DMZ with proper hardening.',
    'Security', 'HIGH', 'REJECT',
    'HKMA requires all Internet traffic to terminate in DMZ first. Direct Internet→Intranet connections are prohibited.',
    'Rule: Internet → Intranet on TCP/8080 without WAF or reverse proxy',
    'Check if source zone is Internet and destination zone is not DMZ, or if source is Internet with no proxy/WAF in path'),

  ('C-VDI-01',  'DEV VDI to Production Access',
    'Development VDI machines must not access production systems using privileged management ports such as SSH, RDP, or database ports.',
    'Security', 'HIGH', 'REJECT',
    'Separation of development and production environments is mandatory per HKMA IT Security Policy.',
    'Rule: DEV VDI → PROD Database on TCP/1433 (SQL Server)',
    'Check if source contains DEV/VDI and destination is PROD, with privileged ports (22,3389,1433,3306,5432,27017)'),

  ('C-OUT-01',  'Direct Outgoing Internet Access',
    'Outbound Internet connections should go through the DMZ proxy. Direct connections from Intranet to Internet bypass security controls.',
    'Security', 'MEDIUM', 'REQUEST_INFO',
    'All outbound traffic must traverse the DMZ forward proxy for content inspection and logging.',
    'Rule: Intranet App → Internet on TCP/443 directly (no proxy in path)',
    'Check if source zone is Intranet and destination zone is Internet with no proxy/DMZ intermediary'),

  ('C-SEC-01',  'Privileged Port Access Across Zones',
    'SSH (22), Telnet (23), RDP (3389), SMB (445), LDAP (389/636) and other management ports must not be opened across security zone boundaries without explicit justification.',
    'Security', 'HIGH', 'REJECT',
    'Cross-zone management access is restricted to break-glass scenarios with full audit trail.',
    'Rule: DMZ → Intranet on TCP/22 (SSH) without justification',
    'Check for privileged ports (22,23,3389,445,389,636,88,135,139,5985,5986) when source_zone != dest_zone'),

  ('C-SEC-02',  'Unencrypted Traffic Across Zones',
    'Unencrypted protocols (HTTP/80, FTP/21, Telnet/23, TFTP/69, SNMPv1-v2/161) should not be used for cross-zone communication.',
    'Security', 'MEDIUM', 'REQUEST_INFO',
    'Encryption in transit is required for all cross-zone data flows per HKMA data protection policy.',
    'Rule: DMZ → Intranet on TCP/80 (HTTP) instead of TCP/443 (HTTPS)',
    'Check for unencrypted ports (80,21,23,69,161) when source_zone != dest_zone'),

  ('C-DES-01',  'Missing Design Reference',
    'Firewall requests must reference an ARB-approved system design. Requests without design references cannot be validated against intended architecture.',
    'Documentation', 'MEDIUM', 'REQUEST_INFO',
    'Every firewall rule must trace back to an approved system design document.',
    'Firewall request submitted without any ARB ticket or design document reference',
    'Check if request has no SDR/SRA reference and no ARB link'),

  ('C-RULE-01', 'All Ports / Any Service Not Allowed',
    'Rules specifying "any" for services or port ranges covering all ports (0-65535) are prohibited. Each connection must specify exact protocols and ports.',
    'Security', 'HIGH', 'REJECT',
    'Overly permissive rules violate the principle of least privilege.',
    'Rule: App Server → Database on Any/Any',
    'Check if services contain "any" or port range 0-65535'),

  ('C-ZONE-01', 'Broad Port Access Across Zones',
    'Rules opening large port ranges across security zone boundaries require ITS endorsement and detailed justification.',
    'Security', 'HIGH', 'REJECT',
    'Cross-zone rules must follow least-privilege and be as specific as possible.',
    'Rule: DMZ → Intranet on TCP/1-10000',
    'Check if port range spans more than 10 ports across different zones'),

  ('C-OA-01',   'Internet to OA/Intranet Access',
    'Direct connections from Internet to the OA/Intranet network are strictly prohibited. All Internet traffic must terminate in DMZ.',
    'Security', 'HIGH', 'REJECT',
    'The Intranet zone is the most protected and must never be directly reachable from the Internet.',
    'Rule: Internet → Intranet on TCP/443',
    'Check if source_zone is Internet and dest_zone is Intranet'),

  ('C-MGMT-01', 'Any Internet Source to DMZ',
    'Rules allowing any Internet IP (0.0.0.0/0) to DMZ services should be reviewed for appropriate source restriction.',
    'Security', 'HIGH', 'REQUEST_INFO',
    'DMZ services should restrict source IPs where possible, even for public-facing services.',
    'Rule: 0.0.0.0/0 → DMZ Web Server on TCP/443 without WAF',
    'Check if source is Internet/any and dest_zone is DMZ without endorsement'),

  ('C-WF-01',   'Missing Rules Category',
    'Firewall requests must specify whether rules are New, Modification, or Deletion to ensure proper change tracking.',
    'Workflow', 'MEDIUM', 'REQUEST_INFO',
    'Rule category is required for change management and audit trail.',
    'Firewall request with no category specified for any rules',
    'Check if rules lack category field'),

  ('C-WF-02',   'Missing Responsible Manager',
    'All firewall requests must have an identified responsible manager for accountability.',
    'Workflow', 'MEDIUM', 'REQUEST_INFO',
    'Manager identification is required for approval chain.',
    'Firewall request without manager/assignee',
    'Check if request has no manager identified'),

  ('C-WF-03',   'Missing Rules Manager Approval',
    'High-risk firewall rules require explicit manager approval documented in the request.',
    'Workflow', 'HIGH', 'REJECT',
    'Manager approval is required before ITS processes any firewall changes.',
    'Firewall request with HIGH-risk rules but no manager approval comment',
    'Check if HIGH-severity rules present but no approval in comments'),

  ('C-WF-04',   'Missing ARB Link for New Systems',
    'New system firewall requests must reference an approved ARB ticket. Without ARB approval, the system design is not validated.',
    'Workflow', 'HIGH', 'REJECT',
    'ARB approval is prerequisite for any new system connections.',
    'New firewall rules for a system with no ARB ticket reference',
    'Check if category is New and no ARB link/reference provided');
