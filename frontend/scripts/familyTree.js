// JanSetu Visual Family Tree & Relationship Graph Engine
// Renders an interactive SVG relationship graph distinguishing Household Membership from Family Relationships

function renderFamilyTree(containerId, members, relationships, highlightCitizenId = null) {
  const container = document.getElementById(containerId);
  if (!container) return;

  if (!members || members.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; padding: 40px; color: var(--text-muted);">
        <p>No family member records found to generate relationship graph.</p>
      </div>
    `;
    return;
  }

  // Group members by their CURRENT Household (Family ID)
  const householdGroups = {};
  members.forEach(m => {
    const fid = m.currentFamilyId || 'UNKNOWN';
    if (!householdGroups[fid]) householdGroups[fid] = [];
    householdGroups[fid].push(m);
  });

  const familyIds = Object.keys(householdGroups);
  const isMultiHousehold = familyIds.length > 1;

  // Layout dimensions
  const width = Math.max(container.clientWidth || 700, 680);
  const height = isMultiHousehold ? 460 : Math.max(380, 120 + Math.ceil(members.length / 3) * 120);

  let svgHtml = `
    <svg width="100%" height="${height}" viewBox="0 0 ${width} ${height}" style="background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; font-family: Inter, sans-serif;">
      <defs>
        <filter id="cardShadow" x="-10%" y="-10%" width="120%" height="130%">
          <feDropShadow dx="0" dy="2" stdDeviation="3" flood-opacity="0.08"/>
        </filter>
        <marker id="arrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#64748b"/>
        </marker>
        <marker id="heart" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="8" markerHeight="8">
          <circle cx="5" cy="5" r="3" fill="#e11d48"/>
        </marker>
      </defs>
  `;

  // Position nodes
  const nodePositions = {};
  const nodeWidth = 150;
  const nodeHeight = 75;

  if (!isMultiHousehold) {
    // Single Household Layout (e.g. FAM-1001 Rahul, Sunita, Amit, Aarav)
    // Draw Household Boundary Box
    svgHtml += `
      <rect x="20" y="20" width="${width - 40}" height="${height - 40}" rx="12" fill="#f8fafc" stroke="#2563eb" stroke-dasharray="6,6" stroke-width="2"/>
      <rect x="35" y="10" width="170" height="24" rx="4" fill="#2563eb"/>
      <text x="45" y="26" fill="#ffffff" font-size="11" font-weight="700">HOUSEHOLD: ${familyIds[0]}</text>
    `;

    const centerX = width / 2;

    if (members.length === 1) {
      // Single person household (e.g. newly separated citizen)
      nodePositions[members[0].citizenId] = { x: centerX - (nodeWidth / 2), y: 100 };
    } else if (members.length === 2) {
      // 2-member household (e.g. Head & Spouse)
      nodePositions[members[0].citizenId] = { x: centerX - 165, y: 90 };
      nodePositions[members[1].citizenId] = { x: centerX + 15, y: 90 };
    } else if (members.length === 3) {
      // 3-member household (e.g. Post-separation remaining family)
      const head = members.find(m => m.isHeadOfFamily) || members[0];
      const otherMembers = members.filter(m => m.citizenId !== head.citizenId);
      nodePositions[head.citizenId] = { x: centerX - 165, y: 70 };
      nodePositions[otherMembers[0].citizenId] = { x: centerX + 15, y: 70 };
      nodePositions[otherMembers[1].citizenId] = { x: centerX - (nodeWidth / 2), y: 220 };
    } else if (members.length === 4) {
      // 4-member initial combined household
      const m1001 = members.find(m => m.citizenId === 'CIT-1001');
      const m1003 = members.find(m => m.citizenId === 'CIT-1003');
      const m1002 = members.find(m => m.citizenId === 'CIT-1002');
      const m1004 = members.find(m => m.citizenId === 'CIT-1004');
      if (m1001 && m1003 && m1002 && m1004) {
        nodePositions['CIT-1001'] = { x: centerX - 180, y: 70 };
        nodePositions['CIT-1003'] = { x: centerX + 30, y: 70 };
        nodePositions['CIT-1002'] = { x: centerX - 260, y: 220 };
        nodePositions['CIT-1004'] = { x: centerX - 75, y: 220 };
      } else {
        members.forEach((m, idx) => {
          nodePositions[m.citizenId] = {
            x: 50 + (idx % 2) * 190,
            y: 70 + Math.floor(idx / 2) * 140
          };
        });
      }
    } else {
      // Dynamic grid for 5+ members
      members.forEach((m, idx) => {
        nodePositions[m.citizenId] = {
          x: 40 + (idx % 3) * 190,
          y: 70 + Math.floor(idx / 3) * 140
        };
      });
    }

  } else {
    // Multi-Household Layout (e.g. Post-Separation: FAM-1001 and FAM-2001)
    const colWidth = (width - 60) / 2;

    // Household 1 (Original)
    svgHtml += `
      <rect x="20" y="20" width="${colWidth}" height="${height - 40}" rx="12" fill="#f8fafc" stroke="#0f284e" stroke-dasharray="6,6" stroke-width="2"/>
      <rect x="35" y="10" width="160" height="24" rx="4" fill="#0f284e"/>
      <text x="45" y="26" fill="#ffffff" font-size="11" font-weight="700">HOUSEHOLD: ${familyIds[0]}</text>
    `;

    // Household 2 (Separated)
    svgHtml += `
      <rect x="${colWidth + 40}" y="20" width="${colWidth}" height="${height - 40}" rx="12" fill="#fffbeb" stroke="#e65100" stroke-dasharray="6,6" stroke-width="2"/>
      <rect x="${colWidth + 55}" y="10" width="190" height="24" rx="4" fill="#e65100"/>
      <text x="${colWidth + 65}" y="26" fill="#ffffff" font-size="11" font-weight="700">NEW HOUSEHOLD: ${familyIds[1]}</text>
    `;

    // Position members in col 1
    const h1Members = householdGroups[familyIds[0]] || [];
    h1Members.forEach((m, idx) => {
      nodePositions[m.citizenId] = {
        x: 45 + (idx % 2) * 125,
        y: 65 + Math.floor(idx / 2) * 135
      };
    });

    // Position members in col 2
    const h2Members = householdGroups[familyIds[1]] || [];
    h2Members.forEach((m, idx) => {
      nodePositions[m.citizenId] = {
        x: colWidth + 65 + (idx % 2) * 125,
        y: 65 + Math.floor(idx / 2) * 135
      };
    });
  }

  // Draw Relationship Lines
  if (relationships && relationships.length > 0) {
    relationships.forEach(rel => {
      const p1 = nodePositions[rel.citizenId1];
      const p2 = nodePositions[rel.citizenId2];
      if (!p1 || !p2) return;

      const x1 = p1.x + nodeWidth / 2;
      const y1 = p1.y + nodeHeight / 2;
      const x2 = p2.x + nodeWidth / 2;
      const y2 = p2.y + nodeHeight / 2;

      const isCrossHousehold = isMultiHousehold && (
        (members.find(m => m.citizenId === rel.citizenId1)?.currentFamilyId) !==
        (members.find(m => m.citizenId === rel.citizenId2)?.currentFamilyId)
      );

      const strokeColor = isCrossHousehold ? '#e65100' : (rel.relationshipType === 'Spouse' ? '#e11d48' : '#2563eb');
      const strokeWidth = isCrossHousehold ? 3 : 2;
      const strokeDash = isCrossHousehold ? '4,4' : 'none';

      // Line
      svgHtml += `
        <line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${strokeColor}" stroke-width="${strokeWidth}" stroke-dasharray="${strokeDash}" opacity="0.8"/>
      `;

      // Label background & text
      const midX = (x1 + x2) / 2;
      const midY = (y1 + y2) / 2;
      const labelText = isCrossHousehold 
        ? `${rel.relationshipType} (BOND PRESERVED)` 
        : rel.relationshipType;

      const badgeWidth = labelText.length * 6.5 + 16;
      svgHtml += `
        <rect x="${midX - badgeWidth / 2}" y="${midY - 10}" width="${badgeWidth}" height="20" rx="10" fill="${isCrossHousehold ? '#fff7ed' : '#ffffff'}" stroke="${strokeColor}" stroke-width="1.5"/>
        <text x="${midX}" y="${midY + 4}" fill="${strokeColor}" font-size="10" font-weight="700" text-anchor="middle">${labelText}</text>
      `;
    });
  }

  // Draw Citizen Nodes
  members.forEach(m => {
    const pos = nodePositions[m.citizenId];
    if (!pos) return;

    const isSelected = highlightCitizenId === m.citizenId;
    const isHead = m.isHeadOfFamily;
    const genderIcon = m.gender === 'Female' ? '👩' : (m.age < 18 ? '👦' : '👨');

    svgHtml += `
      <g onclick="viewMemberDetails('${m.citizenId}')" transform="translate(${pos.x}, ${pos.y})" style="cursor: pointer;" filter="url(#cardShadow)">
        <title>Click to view profile, documents and schemes for ${m.fullName} (${m.citizenId})</title>
        <rect width="${nodeWidth}" height="${nodeHeight}" rx="10" fill="#ffffff" stroke="${isSelected ? '#2563eb' : (isHead ? '#0f284e' : '#cbd5e1')}" stroke-width="${isSelected || isHead ? '2.5' : '1.5'}"/>
        
        <!-- Header color bar -->
        <path d="M 0 10 Q 0 0 10 0 L ${nodeWidth - 10} 0 Q ${nodeWidth} 0 ${nodeWidth} 10 L ${nodeWidth} 18 L 0 18 Z" fill="${isHead ? '#0f284e' : '#f1f5f9'}"/>
        <text x="8" y="13" font-size="8.5" font-weight="700" fill="${isHead ? '#ffffff' : '#475569'}">
          ${isHead ? 'HEAD OF HOUSEHOLD' : (m.gender || 'MEMBER').toUpperCase()}
        </text>
        <text x="${nodeWidth - 8}" y="13" font-size="8.5" font-weight="700" fill="${isHead ? '#ff9933' : '#64748b'}" text-anchor="end">
          ${m.citizenId}
        </text>

        <!-- Citizen Avatar & Details -->
        <text x="12" y="44" font-size="20">${genderIcon}</text>
        <text x="42" y="38" font-size="12" font-weight="700" fill="#0f172a">${m.fullName.length > 14 ? m.fullName.substring(0, 13) + '..' : m.fullName}</text>
        <text x="42" y="52" font-size="10" fill="#64748b">${m.age} yrs • ${m.occupation ? m.occupation.split(' ')[0] : 'Resident'}</text>
        
        <!-- Current Family Tag & Click Hint -->
        <rect x="8" y="58" width="${nodeWidth - 16}" height="12" rx="3" fill="#eff6ff" stroke="#bfdbfe"/>
        <text x="${nodeWidth / 2}" y="67" font-size="7.5" font-weight="700" fill="#1d4ed8" text-anchor="middle">
          🔍 Click for Info, Docs & Schemes
        </text>
      </g>
    `;
  });

  // Legend at bottom
  svgHtml += `
    <g transform="translate(25, ${height - 25})">
      <circle cx="5" cy="5" r="4" fill="#0f284e"/>
      <text x="14" y="8" font-size="10" fill="#475569">Head of Household</text>
      
      <circle cx="140" cy="5" r="4" fill="#2563eb"/>
      <text x="149" y="8" font-size="10" fill="#475569">Family Relationship</text>

      ${isMultiHousehold ? `
        <line x1="280" y1="5" x2="305" y2="5" stroke="#e65100" stroke-width="2.5" stroke-dasharray="3,3"/>
        <text x="312" y="8" font-size="10" font-weight="700" fill="#e65100">Relationship Survives Separation</text>
      ` : ''}
    </g>
  `;

  svgHtml += `</svg>`;
  container.innerHTML = svgHtml;
}
