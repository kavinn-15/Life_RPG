import { useState, useEffect, useCallback } from 'react';
import { useGame } from '../state/GameContext';
import * as dailyMissionService from '../services/dailyMissionService';
import * as questService from '../services/questService';
import dailyMissionsBanner from '../assets/daily-missions-banner.jpg';
import './DailyMissionsPage.css';

const DEFAULT_MISSIONS_CATALOG = [
  {
    id: 'complete-daily-3',
    title: 'Complete 3 Quests',
    desc: 'Finish any 3 quests from your daily roster.',
    icon: 'task_alt',
    source: 'questsCompletedToday',
    target: 3,
    rewardXp: 150,
    rewardGold: 50,
  },
  {
    id: 'domain-diversifier',
    title: 'Progress in 2 Domains',
    desc: 'Complete at least one quest in 2 distinct domains.',
    icon: 'category',
    source: 'todayDomains',
    target: 2,
    rewardXp: 120,
    rewardGold: 40,
  },
  {
    id: 'gold-rush',
    title: 'Earn 100 Gold',
    desc: 'Bank 100 Gold from quest rewards and bonus bonuses.',
    icon: 'monetization_on',
    source: 'todayGold',
    target: 100,
    rewardXp: 90,
    rewardGold: 50,
  },
  {
    id: 'milestone-march',
    title: 'Complete 5 Milestones',
    desc: 'Check off 5 individual milestone sub-tasks.',
    icon: 'checklist',
    source: 'todayMilestones',
    target: 5,
    rewardXp: 110,
    rewardGold: 35,
  },
  {
    id: 'morning-momentum',
    title: 'Complete 1 Quest Before 12 PM',
    desc: 'Knock out any quest in the morning hours.',
    icon: 'light_mode',
    source: 'todayMorningQuests',
    target: 1,
    rewardXp: 80,
    rewardGold: 25,
  },
  {
    id: 'xp-surge',
    title: 'Earn 200 XP',
    desc: 'Accumulate at least 200 XP from quests and milestones today.',
    icon: 'bolt',
    source: 'todayXp',
    target: 200,
    rewardXp: 100,
    rewardGold: 30,
  },
];

function msUntilMidnight() {
  const now = new Date();
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  return midnight.getTime() - now.getTime();
}

function formatCountdown(ms) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const h = String(Math.floor(totalSeconds / 3600)).padStart(2, '0');
  const m = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0');
  const s = String(totalSeconds % 60).padStart(2, '0');
  return `${h}:${m}:${s}`;
}

export default function DailyMissionsPage() {
  const { state, grantRewards, pushToast } = useGame();
  const [countdown, setCountdown] = useState(formatCountdown(msUntilMidnight()));
  const [missionsList, setMissionsList] = useState(DEFAULT_MISSIONS_CATALOG);
  const [claimingId, setClaimingId] = useState(null);

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown(formatCountdown(msUntilMidnight()));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Compute live user stats from completed quests and GameContext state
  const computeLiveMetrics = useCallback(() => {
    const storedQuests = questService.getStoredQuests() || [];
    const todayStr = new Date().toISOString().slice(0, 10);

    const completedQuests = storedQuests.filter((q) => {
      if (q.status !== 'COMPLETED' && !q.completed) return false;
      if (q.completedAt) {
        return q.completedAt.startsWith(todayStr);
      }
      return true;
    });

    const completedQuestsToday = Math.max(
      completedQuests.length,
      state?.questsCompletedToday || 0
    );

    const xpToday = completedQuests.reduce(
      (sum, q) => sum + (q.rewardXp || q.xp || 100),
      0
    );

    const goldToday = completedQuests.reduce(
      (sum, q) => sum + (q.rewardGold || q.gold || 50),
      0
    );

    const distinctDomains = new Set(
      completedQuests
        .map((q) => q.domainId || q.domainName || q.domain || '')
        .filter(Boolean)
    ).size;

    const morningQuests = completedQuests.filter((q) => {
      if (!q.completedAt) return false;
      const hour = new Date(q.completedAt).getHours();
      return hour < 12;
    }).length;

    const completedMilestones = storedQuests.reduce((sum, q) => {
      const doneSubtasks = (q.subtasks || []).filter((st) => st.done).length;
      return sum + doneSubtasks;
    }, 0);

    return {
      completedQuestsToday,
      xpToday,
      goldToday,
      distinctDomains: Math.max(distinctDomains, completedQuestsToday > 0 ? 1 : 0),
      morningQuests,
      completedMilestones,
    };
  }, [state?.questsCompletedToday]);

  const loadMissions = useCallback(async () => {
    const metrics = computeLiveMetrics();
    const storedClaimedRaw = localStorage.getItem(`liferpg_claimed_missions_${new Date().toISOString().slice(0, 10)}`);
    const locallyClaimed = storedClaimedRaw ? JSON.parse(storedClaimedRaw) : {};

    try {
      const serverMissions = await dailyMissionService.getDailyMissions();
      if (Array.isArray(serverMissions) && serverMissions.length > 0) {
        const merged = serverMissions.map((m) => {
          const id = m.id?.toLowerCase() || '';
          let current = m.current ?? 0;

          // Merge with live local metrics to ensure immediate responsiveness
          if (id.includes('quest') || id.includes('3') || id.includes('threat') || m.source === 'activeQuests' || m.source === 'questsCompletedToday') {
            current = Math.max(current, metrics.completedQuestsToday);
          } else if (id.includes('domain') || m.source === 'todayDomains') {
            current = Math.max(current, metrics.distinctDomains);
          } else if (id.includes('gold') || m.source === 'todayGold') {
            current = Math.max(current, metrics.goldToday);
          } else if (id.includes('milestone') || m.source === 'todayMilestones') {
            current = Math.max(current, metrics.completedMilestones);
          } else if (id.includes('morning') || id.includes('12pm') || m.source === 'todayMorningQuests') {
            current = Math.max(current, metrics.morningQuests);
          } else if (id.includes('xp') || id.includes('surge') || m.source === 'todayXp') {
            current = Math.max(current, metrics.xpToday);
          }

          const target = m.target || 1;
          const isComplete = current >= target;
          const isClaimed = Boolean(m.claimed || locallyClaimed[m.id]);

          return {
            id: m.id,
            title: m.title,
            desc: m.description || m.desc,
            icon: m.icon || 'task_alt',
            source: m.source,
            current,
            target,
            rewardXp: m.rewardXp || 100,
            rewardGold: m.rewardGold || 30,
            completed: isComplete,
            claimed: isClaimed,
          };
        });
        setMissionsList(merged);
        return;
      }
    } catch {
      // Offline / local fallback
    }

    // Fallback using catalog & local metrics
    const fallbackList = DEFAULT_MISSIONS_CATALOG.map((m) => {
      let current = 0;
      if (m.source === 'questsCompletedToday') current = metrics.completedQuestsToday;
      else if (m.source === 'todayDomains') current = metrics.distinctDomains;
      else if (m.source === 'todayGold') current = metrics.goldToday;
      else if (m.source === 'todayMilestones') current = metrics.completedMilestones;
      else if (m.source === 'todayMorningQuests') current = metrics.morningQuests;
      else if (m.source === 'todayXp') current = metrics.xpToday;

      const isComplete = current >= m.target;
      const isClaimed = Boolean(locallyClaimed[m.id]);

      return {
        ...m,
        current,
        completed: isComplete,
        claimed: isClaimed,
      };
    });

    setMissionsList(fallbackList);
  }, [computeLiveMetrics]);

  useEffect(() => {
    loadMissions();
  }, [loadMissions, state?.questsCompletedToday, state?.xp, state?.gold]);

  const handleClaimReward = async (mission) => {
    if (mission.claimed || mission.current < mission.target) return;
    setClaimingId(mission.id);

    try {
      await dailyMissionService.claimDailyMission(mission.id);
    } catch {
      // Proceed with local claim
    }

    // Save claim state locally
    const todayKey = `liferpg_claimed_missions_${new Date().toISOString().slice(0, 10)}`;
    const storedClaimedRaw = localStorage.getItem(todayKey);
    const locallyClaimed = storedClaimedRaw ? JSON.parse(storedClaimedRaw) : {};
    locallyClaimed[mission.id] = true;
    localStorage.setItem(todayKey, JSON.stringify(locallyClaimed));

    // Award XP & Gold to character
    grantRewards?.({
      xp: mission.rewardXp,
      gold: mission.rewardGold,
      questTitle: `Daily Mission: ${mission.title}`,
    });

    pushToast?.(
      `Daily Mission Claimed! +${mission.rewardXp} XP · +${mission.rewardGold} Gold`,
      'military_tech'
    );

    setMissionsList((prev) =>
      prev.map((m) => (m.id === mission.id ? { ...m, claimed: true } : m))
    );
    setClaimingId(null);
  };

  // Calculate live HUD stats
  const completedMissionsCount = missionsList.filter(
    (m) => m.current >= m.target
  ).length;

  const totalPossibleXp = missionsList.reduce(
    (acc, m) => acc + (m.rewardXp || 0),
    0
  );

  return (
    <div className="daily-missions-container">
      {/* 1. Header Panoramic Hero Banner */}
      <section className="missions-hero-banner">
        <div className="missions-hero-scenery">
          <img
            src={dailyMissionsBanner}
            alt="Quartermaster's Board Scenery"
            className="w-full h-full object-cover object-[center_35%]"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[#f1f3fd] via-[#f1f3fd]/85 via-45% to-transparent" />
        </div>

        {/* Left Hero Content */}
        <div className="missions-hero-content">
          <span className="missions-hero-badge">QUARTERMASTER&apos;S BOARD</span>
          <h1 className="missions-hero-title">
            <span className="material-symbols-outlined text-[30px] text-[#6366f1]">
              event_available
            </span>
            <span>Daily Missions</span>
          </h1>
          <p className="missions-hero-subtitle">
            A fresh set of bite-sized goals every day. Clear them all before the board resets at midnight.
          </p>
        </div>

        {/* Right Floating HUD Stats Card */}
        <div className="missions-hud-card hidden lg:flex">
          {/* 1. Missions Complete */}
          <div className="missions-hud-stat">
            <div className="missions-hud-icon-box bg-[#dcfce7]">
              <span className="material-symbols-outlined text-[#15803d] text-[22px]">
                check_circle
              </span>
            </div>
            <div className="missions-hud-stat-info">
              <span className="missions-hud-stat-val">{completedMissionsCount} / {missionsList.length}</span>
              <span className="missions-hud-stat-lbl">MISSIONS COMPLETE</span>
            </div>
          </div>

          <div className="missions-hud-divider" />

          {/* 2. Total XP Today */}
          <div className="missions-hud-stat">
            <div className="missions-hud-icon-box bg-[#fef3c7]">
              <span className="material-symbols-outlined text-[#d97706] text-[22px]">
                bolt
              </span>
            </div>
            <div className="missions-hud-stat-info">
              <span className="missions-hud-stat-val">+{totalPossibleXp}</span>
              <span className="missions-hud-stat-lbl">TOTAL XP TODAY</span>
            </div>
          </div>

          <div className="missions-hud-divider" />

          {/* 3. Until Reset */}
          <div className="missions-hud-stat">
            <div className="missions-hud-icon-box bg-[#ede9fe]">
              <span className="material-symbols-outlined text-[#6366f1] text-[22px]">
                schedule
              </span>
            </div>
            <div className="missions-hud-stat-info">
              <span className="missions-hud-stat-val">{countdown}</span>
              <span className="missions-hud-stat-lbl">UNTIL RESET</span>
            </div>
          </div>
        </div>
      </section>

      {/* 2. Daily Missions List */}
      <section className="missions-list">
        {missionsList.map((m) => {
          const isComplete = m.current >= m.target;
          const isClaimed = Boolean(m.claimed);
          const progressPct = Math.min(
            100,
            Math.round((m.current / m.target) * 100)
          );

          return (
            <div
              key={m.id}
              className={`mission-row-card ${isComplete ? 'completed' : ''}`}
            >
              {/* Left Details */}
              <div className="mission-row-left">
                <div className="mission-icon-box">
                  <span className="material-symbols-outlined text-[24px]">
                    {isComplete ? 'verified' : m.icon}
                  </span>
                </div>

                <div className="mission-details-col">
                  <h3 className="mission-row-title">{m.title}</h3>
                  <p className="mission-row-desc">{m.desc}</p>
                  <div className="mission-row-track">
                    <div
                      className="mission-row-fill"
                      style={{ width: `${progressPct}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Right Counter & Badges / Claim Action */}
              <div className="mission-row-right">
                <div className="mission-badges-row">
                  <span className="mission-count-badge">
                    {Math.min(m.current, m.target)}/{m.target}
                  </span>
                  <span className="mission-pill-xp">+{m.rewardXp} XP</span>
                  <span className="mission-pill-gold">+{m.rewardGold} Gold</span>

                  {/* Interactive Claim Reward Button */}
                  {isComplete && !isClaimed && (
                    <button
                      type="button"
                      className="mission-claim-btn"
                      disabled={claimingId === m.id}
                      onClick={() => handleClaimReward(m)}
                    >
                      <span className="material-symbols-outlined text-[16px]">redeem</span>
                      <span>{claimingId === m.id ? 'Claiming...' : 'Claim Reward'}</span>
                    </button>
                  )}

                  {/* Claimed Status */}
                  {isClaimed && (
                    <span className="mission-claimed-badge">
                      <span className="material-symbols-outlined text-[16px]">check</span>
                      <span>Claimed</span>
                    </span>
                  )}
                </div>

                <div className="mission-timer-row">
                  <span className="material-symbols-outlined text-[15px]">
                    schedule
                  </span>
                  <span>{countdown}</span>
                </div>
              </div>
            </div>
          );
        })}
      </section>
    </div>
  );
}
